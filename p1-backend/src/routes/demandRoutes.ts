import { Router } from 'express'
import { z } from 'zod'

import { createDemandSignal, listDemandSignals } from '../services/demandService'

export const demandRoutes = Router()

const createDemandSignalSchema = z.object({
  skuId: z.string().min(1),
  dcId: z.string().min(1),
  signalDate: z.string().date().optional(),
  historicalDemand: z.number().int().nonnegative(),
  sensedAdjustmentPct: z.number().finite(),
  source: z.string().min(1).max(100),
})

const listDemandSignalsSchema = z.object({
  skuId: z.string().min(1).optional(),
  dcId: z.string().min(1).optional(),
})

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10)

const validationError = (error: z.ZodError): Error & { statusCode: number } => {
  const message = error.issues
    .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
    .join('; ')

  return Object.assign(new Error(message), { statusCode: 400 })
}

demandRoutes.post('/demand-signals', async (req, res, next) => {
  try {
    const input = createDemandSignalSchema.parse(req.body)
    const demandSignal = await createDemandSignal({
      ...input,
      signalDate: input.signalDate ?? todayIsoDate(),
    })

    res.status(201).json({ data: demandSignal })
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(validationError(error))
      return
    }

    next(error)
  }
})

demandRoutes.get('/demand-signals', async (req, res, next) => {
  try {
    const filters = listDemandSignalsSchema.parse(req.query)
    const demandSignals = await listDemandSignals(filters)

    res.status(200).json({ data: demandSignals })
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(validationError(error))
      return
    }

    next(error)
  }
})
