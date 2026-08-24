import { Router } from 'express'
import { z } from 'zod'

import { getInventorySummary, getInventoryWithBatchRisk } from '../services/inventoryService'

export const inventoryRoutes = Router()

const listInventorySchema = z.object({
  skuId: z.string().min(1).optional(),
  dcId: z.string().min(1).optional(),
  detail: z.literal('batches').optional(),
})

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10)

const validationError = (error: z.ZodError): Error & { statusCode: number } => {
  const message = error.issues
    .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
    .join('; ')

  return Object.assign(new Error(message), { statusCode: 400 })
}

inventoryRoutes.get('/inventory', async (req, res, next) => {
  try {
    const { detail, skuId, dcId } = listInventorySchema.parse(req.query)
    const filters = { skuId, dcId }

    if (detail === 'batches') {
      const inventory = await getInventoryWithBatchRisk(filters, todayIsoDate())
      res.status(200).json({ data: inventory })
      return
    }

    const stock = await getInventorySummary(filters)
    res.status(200).json({ data: { stock } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(validationError(error))
      return
    }

    next(error)
  }
})
