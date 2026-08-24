import { Router } from 'express'
import { z } from 'zod'

import { supabaseClient } from '../db/supabaseClient'
import {
  generateReplenishmentRecommendations,
  type RecommendationUrgency,
} from '../services/recommendationService'

type RecommendationStatus = 'NEW' | 'SENT_TO_PROCUREMENT' | 'ACKNOWLEDGED'

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
  status: RecommendationStatus
  created_at: string
}

const recommendationSelect =
  'id, sku_id, dc_id, recommended_qty, reorder_point, safety_stock, eoq, urgency, reason_code, ai_rationale, status, created_at'

const urgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const statusSchema = z.enum(['NEW', 'SENT_TO_PROCUREMENT', 'ACKNOWLEDGED'])

const listRecommendationsSchema = z.object({
  urgency: urgencySchema.optional(),
  status: statusSchema.optional(),
})

const recalculateSchema = z.object({
  skuId: z.string().min(1).optional(),
  dcId: z.string().min(1).optional(),
  today: z.string().date().optional(),
})

const idParamSchema = z.object({
  id: z.string().uuid(),
})

const validationError = (error: z.ZodError): Error & { statusCode: number } => {
  const message = error.issues
    .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
    .join('; ')

  return Object.assign(new Error(message), { statusCode: 400 })
}

const toRecommendation = (row: RecommendationRow) => ({
  id: row.id,
  skuId: row.sku_id,
  dcId: row.dc_id,
  recommendedQty: row.recommended_qty,
  reorderPoint: Number(row.reorder_point),
  safetyStock: Number(row.safety_stock),
  eoq: Number(row.eoq),
  urgency: row.urgency,
  reasonCode: row.reason_code,
  aiRationale: row.ai_rationale ?? '',
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
})

const summarizeByUrgency = (
  recommendations: Array<{ urgency: RecommendationUrgency }>,
): Record<RecommendationUrgency, number> =>
  recommendations.reduce<Record<RecommendationUrgency, number>>(
    (summary, recommendation) => ({
      ...summary,
      [recommendation.urgency]: summary[recommendation.urgency] + 1,
    }),
    { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  )

export const replenishmentRoutes = Router()

replenishmentRoutes.get('/replenishment/recommendations', async (req, res, next) => {
  try {
    const filters = listRecommendationsSchema.parse(req.query)
    let query = supabaseClient
      .schema('p1')
      .from('replenishment_recommendations')
      .select(recommendationSelect)
      .order('created_at', { ascending: false })

    if (filters.urgency) {
      query = query.eq('urgency', filters.urgency)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to list replenishment recommendations: ${error.message}`)
    }

    res.status(200).json({ data: ((data ?? []) as RecommendationRow[]).map(toRecommendation) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(validationError(error))
      return
    }

    next(error)
  }
})

replenishmentRoutes.post('/replenishment/recalculate', async (req, res, next) => {
  try {
    const input = recalculateSchema.parse(req.body ?? {})
    const recommendations = await generateReplenishmentRecommendations(input)

    res.status(201).json({
      data: {
        count: recommendations.length,
        byUrgency: summarizeByUrgency(recommendations),
        recommendations,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(validationError(error))
      return
    }

    next(error)
  }
})

replenishmentRoutes.get('/replenishment/recommendations/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await supabaseClient
      .schema('p1')
      .from('replenishment_recommendations')
      .select(recommendationSelect)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load replenishment recommendation: ${error.message}`)
    }

    if (!data) {
      res.status(404).json({ error: 'Replenishment recommendation not found' })
      return
    }

    res.status(200).json({ data: toRecommendation(data as RecommendationRow) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(validationError(error))
      return
    }

    next(error)
  }
})
