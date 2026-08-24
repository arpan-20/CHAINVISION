export type ExpiryRiskLevel = 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'OK'

export interface InventoryBatchForRisk {
  id: string
  skuId: string
  dcId: string
  batchNo: string
  quantity: number
  expiryDate: string
  receivedDate: string
}

export interface ExpiryRiskResult extends InventoryBatchForRisk {
  daysUntilExpiry: number
  expiryRisk: ExpiryRiskLevel
}

const millisecondsPerDay = 24 * 60 * 60 * 1000

const parseIsoDateAtUtcMidnight = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`)
  }

  return parsed
}

const daysBetween = (fromDate: string, toDate: string): number => {
  const from = parseIsoDateAtUtcMidnight(fromDate)
  const to = parseIsoDateAtUtcMidnight(toDate)

  return Math.round((to.getTime() - from.getTime()) / millisecondsPerDay)
}

const classifyExpiryRisk = (daysUntilExpiry: number): ExpiryRiskLevel => {
  if (daysUntilExpiry < 0) {
    return 'EXPIRED'
  }

  // Phase 6 P6.1 deterministic thresholds: today-30 days is CRITICAL,
  // 31-90 days is WARNING, and anything beyond 90 days is OK.
  if (daysUntilExpiry <= 30) {
    return 'CRITICAL'
  }

  if (daysUntilExpiry <= 90) {
    return 'WARNING'
  }

  return 'OK'
}

export const scoreExpiryRisk = (
  batches: InventoryBatchForRisk[],
  today: string,
): ExpiryRiskResult[] =>
  batches.map((batch) => {
    if (!Number.isFinite(batch.quantity) || batch.quantity < 0) {
      throw new Error('Batch quantity values must be finite, non-negative numbers')
    }

    const daysUntilExpiry = daysBetween(today, batch.expiryDate)

    return {
      ...batch,
      daysUntilExpiry,
      expiryRisk: classifyExpiryRisk(daysUntilExpiry),
    }
  })
