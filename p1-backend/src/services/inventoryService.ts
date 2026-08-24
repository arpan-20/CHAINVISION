import {
  type ExpiryRiskLevel,
  type InventoryBatchForRisk,
  scoreExpiryRisk,
} from '../engine/expiryRiskEngine'
import { supabaseClient } from '../db/supabaseClient'

export interface ListInventoryFilters {
  skuId?: string
  dcId?: string
}

export interface InventoryStockSummary {
  skuId: string
  dcId: string
  currentStock: number
  batchCount: number
}

export interface InventoryBatch extends InventoryBatchForRisk {}

export interface InventoryBatchWithRisk extends InventoryBatch {
  daysUntilExpiry: number
  expiryRisk: ExpiryRiskLevel
}

interface InventoryBatchRow {
  id: string
  sku_id: string
  dc_id: string
  batch_no: string
  quantity: number
  expiry_date: string
  received_date: string
}

const inventoryBatchesTable = () => supabaseClient.schema('p1').from('inventory_batches')

const toInventoryBatch = (row: InventoryBatchRow): InventoryBatch => ({
  id: row.id,
  skuId: row.sku_id,
  dcId: row.dc_id,
  batchNo: row.batch_no,
  quantity: row.quantity,
  expiryDate: row.expiry_date,
  receivedDate: row.received_date,
})

const aggregateCurrentStock = (batches: InventoryBatch[]): InventoryStockSummary[] => {
  const grouped = new Map<string, InventoryStockSummary>()

  for (const batch of batches) {
    const key = `${batch.skuId}:${batch.dcId}`
    const current = grouped.get(key) ?? {
      skuId: batch.skuId,
      dcId: batch.dcId,
      currentStock: 0,
      batchCount: 0,
    }

    current.currentStock += batch.quantity
    current.batchCount += 1
    grouped.set(key, current)
  }

  return [...grouped.values()].sort((left, right) =>
    left.skuId === right.skuId
      ? left.dcId.localeCompare(right.dcId)
      : left.skuId.localeCompare(right.skuId),
  )
}

export const listInventoryBatches = async (
  filters: ListInventoryFilters = {},
): Promise<InventoryBatch[]> => {
  let query = inventoryBatchesTable()
    .select('id, sku_id, dc_id, batch_no, quantity, expiry_date, received_date')
    .order('expiry_date', { ascending: true })

  if (filters.skuId) {
    query = query.eq('sku_id', filters.skuId)
  }

  if (filters.dcId) {
    query = query.eq('dc_id', filters.dcId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list inventory batches: ${error.message}`)
  }

  return ((data ?? []) as InventoryBatchRow[]).map(toInventoryBatch)
}

export const getInventorySummary = async (
  filters: ListInventoryFilters = {},
): Promise<InventoryStockSummary[]> => {
  const batches = await listInventoryBatches(filters)

  return aggregateCurrentStock(batches)
}

export const getInventoryWithBatchRisk = async (
  filters: ListInventoryFilters = {},
  today: string,
): Promise<{
  stock: InventoryStockSummary[]
  batches: InventoryBatchWithRisk[]
}> => {
  const batches = await listInventoryBatches(filters)

  return {
    stock: aggregateCurrentStock(batches),
    batches: scoreExpiryRisk(batches, today),
  }
}
