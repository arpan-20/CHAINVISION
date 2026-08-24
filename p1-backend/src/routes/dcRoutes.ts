import { Router } from 'express'

import { supabaseClient } from '../db/supabaseClient'

interface DistributionCenterRow {
  id: string
  dc_code: string
  name: string
  region: string
  capacity_units: number
}

const toDistributionCenter = (row: DistributionCenterRow) => ({
  id: row.id,
  dcCode: row.dc_code,
  name: row.name,
  region: row.region,
  capacityUnits: row.capacity_units,
})

export const dcRoutes = Router()

dcRoutes.get('/distribution-centers', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseClient
      .schema('p1')
      .from('distribution_centers')
      .select('id, dc_code, name, region, capacity_units')
      .order('dc_code', { ascending: true })

    if (error) {
      throw new Error(`Failed to list distribution centers: ${error.message}`)
    }

    res
      .status(200)
      .json({ data: ((data ?? []) as DistributionCenterRow[]).map(toDistributionCenter) })
  } catch (error) {
    next(error)
  }
})
