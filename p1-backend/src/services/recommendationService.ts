import { computeSensedDemand, type HistoricalDemandPoint } from '../engine/demandEngine'
import { scoreExpiryRisk, type ExpiryRiskLevel } from '../engine/expiryRiskEngine'
import { sequenceFefo } from '../engine/fefoEngine'
import {
  computeEoq,
  computeReorderPoint,
  computeSafetyStock,
} from '../engine/replenishmentMathEngine'
import { supabaseClient } from '../db/supabaseClient'
import { listDemandSignals, type DemandSignal } from './demandService'
import { listInventoryBatches, type InventoryBatch } from './inventoryService'
import { generateRationale, type RationaleInput } from './aiRationaleService'
import * as pr2ClientService from './pr2ClientService'

export type RecommendationUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface GenerateRecommendationFilters {
  skuId?: string
  dcId?: string
  today?: string
}

export interface ReplenishmentRecommendationContract {
  recommendationId: string
  skuId: string
  skuName: string
  dcId: string
  recommendedQty: number
  urgency: RecommendationUrgency
  reason: string
  aiRationale: string
  expiryRiskContext: string
  generatedAt: string
}

interface SkuMetadata {
  id: string
  name: string
  leadTimeDays: number
}

interface SkuMetadataRow {
  id: string
  name: string
  lead_time_days: number
}

interface RecommendationRow {
  id: string
  sku_id: string
  dc_id: string
  recommended_qty: number
  reorder_point: number | string
  safety_stock: number | string
  eoq: number | string
  urgency: RecommendationUrgency
  reason_code: string
  ai_rationale: string | null
  created_at: string
}

interface ComboInput {
  skuId: string
  dcId: string
  demandSignals: DemandSignal[]
  batches: InventoryBatch[]
  sku: SkuMetadata
  today: string
}

const DEFAULT_LEAD_TIME_DAYS = 14

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10)

const comboKey = (skuId: string, dcId: string): string => `${skuId}:${dcId}`

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

const standardDeviation = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))

  return Math.sqrt(variance)
}

const loadSkuMetadata = async (): Promise<Map<string, SkuMetadata>> => {
  const { data, error } = await supabaseClient
    .schema('p1')
    .from('skus')
    .select('id, name, lead_time_days')

  if (error) {
    throw new Error(`Failed to load SKU metadata: ${error.message}`)
  }

  return new Map(
    ((data ?? []) as SkuMetadataRow[]).map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        leadTimeDays: row.lead_time_days,
      },
    ]),
  )
}

const countByRisk = (
  batches: Array<{ expiryRisk: ExpiryRiskLevel }>,
): Record<ExpiryRiskLevel, number> =>
  batches.reduce<Record<ExpiryRiskLevel, number>>(
    (counts, batch) => ({
      ...counts,
      [batch.expiryRisk]: counts[batch.expiryRisk] + 1,
    }),
    { EXPIRED: 0, CRITICAL: 0, WARNING: 0, OK: 0 },
  )

const determineUrgency = ({
  currentStock,
  daysOfCover,
  leadTimeDays,
  reorderPoint,
  riskCounts,
}: {
  currentStock: number
  daysOfCover: number
  leadTimeDays: number
  reorderPoint: number
  riskCounts: Record<ExpiryRiskLevel, number>
}): RecommendationUrgency => {
  // P7.2 deterministic urgency rule:
  // CRITICAL: no usable cover or less than half lead-time cover.
  // HIGH: stock is below ROP or cover is below lead time.
  // MEDIUM: cover is below 1.5x lead time, or expiry pressure exists.
  // LOW: everything else.
  if (currentStock <= 0 || daysOfCover <= leadTimeDays * 0.5) {
    return 'CRITICAL'
  }

  if (currentStock <= reorderPoint || daysOfCover <= leadTimeDays) {
    return 'HIGH'
  }

  if (
    daysOfCover <= leadTimeDays * 1.5 ||
    riskCounts.EXPIRED > 0 ||
    riskCounts.CRITICAL > 0
  ) {
    return 'MEDIUM'
  }

  return 'LOW'
}

const reasonForUrgency = (
  urgency: RecommendationUrgency,
  riskCounts: Record<ExpiryRiskLevel, number>,
): string => {
  if (urgency === 'CRITICAL') {
    return 'STOCKOUT_RISK'
  }

  if (urgency === 'HIGH') {
    return 'REORDER_POINT_BREACHED'
  }

  if (riskCounts.EXPIRED > 0 || riskCounts.CRITICAL > 0) {
    return 'EXPIRY_PRESSURE'
  }

  if (urgency === 'MEDIUM') {
    return 'LOW_COVER'
  }

  return 'STOCK_HEALTHY'
}

const expiryRiskContext = (
  riskCounts: Record<ExpiryRiskLevel, number>,
  firstFefoBatchNo?: string,
): string =>
  [
    `expired=${riskCounts.EXPIRED}`,
    `critical=${riskCounts.CRITICAL}`,
    `warning=${riskCounts.WARNING}`,
    `ok=${riskCounts.OK}`,
    `firstFefoBatch=${firstFefoBatchNo ?? 'none'}`,
  ].join('; ')

const buildRecommendationForCombo = ({
  skuId,
  dcId,
  demandSignals,
  batches,
  sku,
  today,
}: ComboInput):
  | (Omit<RecommendationRow, 'id' | 'created_at'> & {
      skuName: string
      expiryRiskContext: string
      rationaleInput: Omit<
        RationaleInput,
        'recommendedQty' | 'urgency' | 'reasonCode' | 'expiryRiskContext'
      >
    })
  | null => {
  if (demandSignals.length === 0) {
    return null
  }

  const adjustmentPct = Math.max(
    ...demandSignals.map((signal) => signal.sensedAdjustmentPct),
    0,
  )
  const historical: HistoricalDemandPoint[] = demandSignals.map((signal) => ({
    skuId: signal.skuId,
    dcId: signal.dcId,
    historicalDemand: signal.historicalDemand,
    signalDate: signal.signalDate,
    source: signal.source,
  }))
  const [sensedDemand] = computeSensedDemand(historical, adjustmentPct)

  if (!sensedDemand || sensedDemand.adjustedDemand <= 0) {
    return null
  }

  const leadTimeDays = sku.leadTimeDays || DEFAULT_LEAD_TIME_DAYS
  const currentStock = batches.reduce((total, batch) => total + batch.quantity, 0)
  const demandStdDev = standardDeviation(
    demandSignals.map((signal) => signal.historicalDemand),
  )
  const safetyStock = computeSafetyStock({ demandStdDev, leadTimeDays })
  const reorderPoint = computeReorderPoint({
    averageDailyDemand: sensedDemand.adjustedDemand,
    leadTimeDays,
    safetyStock,
  })
  const annualDemand = sensedDemand.adjustedDemand * 365
  const eoq = computeEoq({ annualDemand })
  const daysOfCover =
    sensedDemand.adjustedDemand === 0 ? Number.POSITIVE_INFINITY : currentStock / sensedDemand.adjustedDemand
  const scoredBatches = scoreExpiryRisk(batches, today)
  const fefoBatches = sequenceFefo(batches)
  const riskCounts = countByRisk(scoredBatches)
  const urgency = determineUrgency({
    currentStock,
    daysOfCover,
    leadTimeDays,
    reorderPoint,
    riskCounts,
  })

  if (urgency === 'LOW') {
    return null
  }

  const replenishmentGap = Math.max(0, reorderPoint - currentStock)
  const recommendedQty = Math.ceil(Math.max(eoq, replenishmentGap))

  return {
    sku_id: skuId,
    dc_id: dcId,
    recommended_qty: recommendedQty,
    reorder_point: reorderPoint,
    safety_stock: safetyStock,
    eoq,
    urgency,
    reason_code: reasonForUrgency(urgency, riskCounts),
    ai_rationale: '',
    skuName: sku.name,
    expiryRiskContext: expiryRiskContext(riskCounts, fefoBatches[0]?.batchNo),
    rationaleInput: {
      skuName: sku.name,
      dcId,
      currentStock,
      daysOfCover,
      reorderPoint,
      safetyStock,
      eoq,
      leadTimeDays,
    },
  }
}

const insertRecommendation = async (
  recommendation: Omit<RecommendationRow, 'id' | 'created_at'>,
): Promise<RecommendationRow> => {
  const { data, error } = await supabaseClient
    .schema('p1')
    .from('replenishment_recommendations')
    .insert({
      sku_id: recommendation.sku_id,
      dc_id: recommendation.dc_id,
      recommended_qty: recommendation.recommended_qty,
      reorder_point: recommendation.reorder_point,
      safety_stock: recommendation.safety_stock,
      eoq: recommendation.eoq,
      urgency: recommendation.urgency,
      reason_code: recommendation.reason_code,
      ai_rationale: recommendation.ai_rationale,
      status: 'NEW',
    })
    .select(
      'id, sku_id, dc_id, recommended_qty, reorder_point, safety_stock, eoq, urgency, reason_code, ai_rationale, created_at',
    )
    .single()

  if (error) {
    throw new Error(`Failed to create replenishment recommendation: ${error.message}`)
  }

  return data as RecommendationRow
}

const updateRecommendationStatus = async (
  recommendationId: string,
  status: 'SENT_TO_PROCUREMENT',
): Promise<void> => {
  const { error } = await supabaseClient
    .schema('p1')
    .from('replenishment_recommendations')
    .update({ status })
    .eq('id', recommendationId)

  if (error) {
    console.error(
      `[recommendationService] Failed to update status to ${status} for ` +
        `recommendationId=${recommendationId}: ${error.message}`,
    )
  }
}

const toContract = (
  row: RecommendationRow,
  skuName: string,
  context: string,
): ReplenishmentRecommendationContract => ({
  recommendationId: row.id,
  skuId: row.sku_id,
  skuName,
  dcId: row.dc_id,
  recommendedQty: row.recommended_qty,
  urgency: row.urgency,
  reason: row.reason_code,
  aiRationale: row.ai_rationale ?? '',
  expiryRiskContext: context,
  generatedAt: new Date(row.created_at).toISOString(),
})

export const generateReplenishmentRecommendations = async (
  filters: GenerateRecommendationFilters = {},
): Promise<ReplenishmentRecommendationContract[]> => {
  const today = filters.today ?? todayIsoDate()
  const [demandSignals, inventoryBatches, skuMetadata] = await Promise.all([
    listDemandSignals({ skuId: filters.skuId, dcId: filters.dcId }),
    listInventoryBatches({ skuId: filters.skuId, dcId: filters.dcId }),
    loadSkuMetadata(),
  ])

  const combos = new Set<string>()
  for (const signal of demandSignals) {
    combos.add(comboKey(signal.skuId, signal.dcId))
  }
  for (const batch of inventoryBatches) {
    combos.add(comboKey(batch.skuId, batch.dcId))
  }

  const recommendations: ReplenishmentRecommendationContract[] = []

  for (const key of [...combos].sort()) {
    const [skuId, dcId] = key.split(':')
    const comboSignals = demandSignals.filter(
      (signal) => signal.skuId === skuId && signal.dcId === dcId,
    )
    const comboBatches = inventoryBatches.filter(
      (batch) => batch.skuId === skuId && batch.dcId === dcId,
    )
    const sku = skuMetadata.get(skuId) ?? {
      id: skuId,
      name: skuId,
      leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
    }
    const candidate = buildRecommendationForCombo({
      skuId,
      dcId,
      demandSignals: comboSignals,
      batches: comboBatches,
      sku,
      today,
    })

    if (!candidate) {
      continue
    }

    const { skuName, expiryRiskContext: context, rationaleInput, ...rowInput } = candidate

    // --- Gemini rationale (Phase 22, P22.1) ---
    // Gemini only phrases already-computed values; all quantity, threshold,
    // urgency, and expiry numbers above remain deterministic engine output.
    rowInput.ai_rationale = await generateRationale({
      ...rationaleInput,
      recommendedQty: rowInput.recommended_qty,
      urgency: rowInput.urgency,
      reasonCode: rowInput.reason_code,
      expiryRiskContext: context,
    })
    // --- end rationale ---

    const row = await insertRecommendation(rowInput)
    const contract = toContract(row, skuName, context)

    // --- P1→PR2 handoff (Phase 20, P20.1) ---
    // No urgency check needed here: buildRecommendationForCombo already
    // returns null for LOW-urgency combos, so `row.urgency` is always
    // MEDIUM/HIGH/CRITICAL by this point.
    try {
      await pr2ClientService.sendRecommendation(contract)
      await updateRecommendationStatus(row.id, 'SENT_TO_PROCUREMENT')
    } catch {
      // failure already logged inside pr2ClientService; recommendation stays NEW
    }
    // --- end handoff ---

    recommendations.push(contract)
  }

  return recommendations
}
