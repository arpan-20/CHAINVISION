import { generateText } from './geminiClient'
import type { RecommendationUrgency } from './recommendationService'

export interface RationaleInput {
  skuName: string
  dcId: string
  recommendedQty: number
  urgency: RecommendationUrgency
  reasonCode: string
  currentStock: number
  daysOfCover: number
  reorderPoint: number
  safetyStock: number
  eoq: number
  leadTimeDays: number
  expiryRiskContext: string
}

const formatNumber = (value: number): string =>
  Number.isFinite(value)
    ? Math.round(value).toLocaleString('en-US')
    : 'unbounded'

const formatDays = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(1) : 'unbounded'

export const fallbackRationale = (input: RationaleInput): string =>
  `Recommended ${formatNumber(input.recommendedQty)} units for ${input.dcId} because ${input.reasonCode.toLowerCase().replace(
    /_/g,
    ' ',
  )}; current stock is ${formatNumber(input.currentStock)} units, covering ${formatDays(
    input.daysOfCover,
  )} days against a ${input.leadTimeDays}-day lead time, with reorder point ${formatNumber(
    input.reorderPoint,
  )} and ${input.expiryRiskContext}.`

const buildPrompt = (input: RationaleInput): string => `
You are writing a one-paragraph supply-chain dashboard rationale for CHAINVISION.
Use only the already-computed facts below. Do not calculate, infer, change, or recommend a different quantity, urgency, threshold, or decision.

Computed facts:
- SKU: ${input.skuName}
- Distribution center: ${input.dcId}
- Recommended quantity: ${input.recommendedQty}
- Urgency: ${input.urgency}
- Deterministic reason code: ${input.reasonCode}
- Current stock: ${input.currentStock}
- Days of cover: ${formatDays(input.daysOfCover)}
- Lead time days: ${input.leadTimeDays}
- Reorder point: ${input.reorderPoint}
- Safety stock: ${input.safetyStock}
- EOQ: ${input.eoq}
- Expiry risk context: ${input.expiryRiskContext}

Return one concise, judge-readable paragraph in plain English. Keep the computed quantity and urgency exactly as provided.
`.trim()

export const generateRationale = async (input: RationaleInput): Promise<string> => {
  try {
    const text = await generateText(buildPrompt(input))

    return text.trim() || fallbackRationale(input)
  } catch (error) {
    console.warn(
      `[aiRationaleService] Gemini rationale failed for sku=${input.skuName}, dc=${input.dcId}: ${
        (error as Error).message
      }`,
    )
    return fallbackRationale(input)
  }
}
