export interface HistoricalDemandPoint {
  skuId: string
  dcId: string
  historicalDemand: number
  signalDate?: string
  source?: string
}

export interface SensedDemandResult {
  skuId: string
  dcId: string
  historicalAverageDemand: number
  adjustmentPct: number
  adjustedDemand: number
  sampleCount: number
}

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100

export const computeSensedDemand = (
  historical: HistoricalDemandPoint[],
  adjustmentPct: number,
): SensedDemandResult[] => {
  if (!Number.isFinite(adjustmentPct)) {
    throw new Error('adjustmentPct must be a finite number')
  }

  const grouped = new Map<string, { skuId: string; dcId: string; total: number; count: number }>()

  for (const point of historical) {
    if (!Number.isFinite(point.historicalDemand) || point.historicalDemand < 0) {
      throw new Error('historicalDemand values must be finite, non-negative numbers')
    }

    const key = `${point.skuId}:${point.dcId}`
    const current = grouped.get(key) ?? {
      skuId: point.skuId,
      dcId: point.dcId,
      total: 0,
      count: 0,
    }

    current.total += point.historicalDemand
    current.count += 1
    grouped.set(key, current)
  }

  return [...grouped.values()].map((group) => {
    const historicalAverageDemand = group.count === 0 ? 0 : group.total / group.count
    const adjustedDemand = historicalAverageDemand * (1 + adjustmentPct / 100)

    return {
      skuId: group.skuId,
      dcId: group.dcId,
      historicalAverageDemand: roundToTwoDecimals(historicalAverageDemand),
      adjustmentPct,
      adjustedDemand: Math.max(0, Math.ceil(adjustedDemand)),
      sampleCount: group.count,
    }
  })
}
