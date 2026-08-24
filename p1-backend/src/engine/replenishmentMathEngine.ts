export interface SafetyStockInput {
  demandStdDev: number
  leadTimeDays: number
  serviceLevelZScore?: number
}

export interface ReorderPointInput {
  averageDailyDemand: number
  leadTimeDays: number
  safetyStock: number
}

export interface EoqInput {
  annualDemand: number
  orderCost?: number
  holdingCostPerUnitPerYear?: number
}

export const DEFAULT_SERVICE_LEVEL_Z_SCORE = 1.65
export const DEFAULT_ORDER_COST = 50
export const DEFAULT_HOLDING_COST_PER_UNIT_PER_YEAR = 2

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100

const ensureNonNegativeFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite, non-negative number`)
  }
}

const ensurePositiveFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than zero`)
  }
}

export const computeSafetyStock = ({
  demandStdDev,
  leadTimeDays,
  serviceLevelZScore = DEFAULT_SERVICE_LEVEL_Z_SCORE,
}: SafetyStockInput): number => {
  ensureNonNegativeFinite('demandStdDev', demandStdDev)
  ensureNonNegativeFinite('leadTimeDays', leadTimeDays)
  ensureNonNegativeFinite('serviceLevelZScore', serviceLevelZScore)

  // Phase 7 P7.1 formula: safety stock = z-score * daily demand std dev * sqrt(lead time days).
  // Hackathon simplification: demand variability is daily and lead time is fixed per SKU/DC.
  return roundToTwoDecimals(serviceLevelZScore * demandStdDev * Math.sqrt(leadTimeDays))
}

export const computeReorderPoint = ({
  averageDailyDemand,
  leadTimeDays,
  safetyStock,
}: ReorderPointInput): number => {
  ensureNonNegativeFinite('averageDailyDemand', averageDailyDemand)
  ensureNonNegativeFinite('leadTimeDays', leadTimeDays)
  ensureNonNegativeFinite('safetyStock', safetyStock)

  // Phase 7 P7.1 formula: ROP = average daily demand * lead time days + safety stock.
  // Hackathon simplification: lead time demand uses the latest sensed average as a constant rate.
  return roundToTwoDecimals(averageDailyDemand * leadTimeDays + safetyStock)
}

export const computeEoq = ({
  annualDemand,
  orderCost = DEFAULT_ORDER_COST,
  holdingCostPerUnitPerYear = DEFAULT_HOLDING_COST_PER_UNIT_PER_YEAR,
}: EoqInput): number => {
  ensureNonNegativeFinite('annualDemand', annualDemand)
  ensurePositiveFinite('orderCost', orderCost)
  ensurePositiveFinite('holdingCostPerUnitPerYear', holdingCostPerUnitPerYear)

  if (annualDemand === 0) {
    return 0
  }

  // Phase 7 P7.1 formula: EOQ = sqrt((2 * annual demand * order cost) / annual holding cost per unit).
  // Hackathon simplification: default order cost is 50 and default holding cost is 2 per unit/year
  // until supplier-specific ordering economics are wired into a later orchestration phase.
  return Math.ceil(
    Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnitPerYear),
  )
}
