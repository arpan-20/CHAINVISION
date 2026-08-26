import { Router } from 'express'

import { verifySupabaseJwt } from '../auth/verifySupabaseJwt'
import { supabaseClient } from '../db/supabaseClient'

interface SkuRow {
  id: string
  sku_code: string
  name: string
  category: string
  unit_cost: number | string
  lead_time_days: number
}

const toSku = (row: SkuRow) => ({
  id: row.id,
  skuCode: row.sku_code,
  name: row.name,
  category: row.category,
  unitCost: Number(row.unit_cost),
  leadTimeDays: row.lead_time_days,
})

export const skuRoutes = Router()

skuRoutes.use(verifySupabaseJwt)

skuRoutes.get('/skus', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseClient
      .schema('p1')
      .from('skus')
      .select('id, sku_code, name, category, unit_cost, lead_time_days')
      .order('sku_code', { ascending: true })

    if (error) {
      throw new Error(`Failed to list SKUs: ${error.message}`)
    }

    res.status(200).json({ data: ((data ?? []) as SkuRow[]).map(toSku) })
  } catch (error) {
    next(error)
  }
})
