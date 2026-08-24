import { supabaseClient } from '../db/supabaseClient'

export interface CreateDemandSignalInput {
  skuId: string
  dcId: string
  signalDate: string
  historicalDemand: number
  sensedAdjustmentPct: number
  source: string
}

export interface DemandSignal {
  id: string
  skuId: string
  dcId: string
  signalDate: string
  historicalDemand: number
  sensedAdjustmentPct: number
  source: string
}

interface DemandSignalRow {
  id: string
  sku_id: string
  dc_id: string
  signal_date: string
  historical_demand: number
  sensed_adjustment_pct: number | string
  source: string
}

export interface ListDemandSignalsFilters {
  skuId?: string
  dcId?: string
}

const toDemandSignal = (row: DemandSignalRow): DemandSignal => ({
  id: row.id,
  skuId: row.sku_id,
  dcId: row.dc_id,
  signalDate: row.signal_date,
  historicalDemand: row.historical_demand,
  sensedAdjustmentPct: Number(row.sensed_adjustment_pct),
  source: row.source,
})

const demandSignalsTable = () => supabaseClient.schema('p1').from('demand_signals')

export const createDemandSignal = async (
  input: CreateDemandSignalInput,
): Promise<DemandSignal> => {
  const { data, error } = await demandSignalsTable()
    .insert({
      sku_id: input.skuId,
      dc_id: input.dcId,
      signal_date: input.signalDate,
      historical_demand: input.historicalDemand,
      sensed_adjustment_pct: input.sensedAdjustmentPct,
      source: input.source,
    })
    .select(
      'id, sku_id, dc_id, signal_date, historical_demand, sensed_adjustment_pct, source',
    )
    .single()

  if (error) {
    throw new Error(`Failed to create demand signal: ${error.message}`)
  }

  return toDemandSignal(data as DemandSignalRow)
}

export const listDemandSignals = async (
  filters: ListDemandSignalsFilters = {},
): Promise<DemandSignal[]> => {
  let query = demandSignalsTable()
    .select('id, sku_id, dc_id, signal_date, historical_demand, sensed_adjustment_pct, source')
    .order('signal_date', { ascending: false })

  if (filters.skuId) {
    query = query.eq('sku_id', filters.skuId)
  }

  if (filters.dcId) {
    query = query.eq('dc_id', filters.dcId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list demand signals: ${error.message}`)
  }

  return ((data ?? []) as DemandSignalRow[]).map(toDemandSignal)
}
