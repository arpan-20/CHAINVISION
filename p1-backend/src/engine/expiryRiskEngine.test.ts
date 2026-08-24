import { describe, expect, it } from 'vitest'

import { scoreExpiryRisk } from './expiryRiskEngine'

const baseBatch = {
  id: 'batch-1',
  skuId: 'sku-1',
  dcId: 'dc-1',
  batchNo: 'MED-101-DC-A',
  quantity: 100,
  receivedDate: '2026-05-26',
}

describe('scoreExpiryRisk', () => {
  it('marks a batch expiring today as critical', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-08-24' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('CRITICAL')
    expect(result.daysUntilExpiry).toBe(0)
  })

  it('marks a far-future batch as ok', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2027-02-20' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('OK')
    expect(result.daysUntilExpiry).toBe(180)
  })

  it('marks an already expired batch as expired', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-08-23' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('EXPIRED')
    expect(result.daysUntilExpiry).toBe(-1)
  })

  it('marks a batch expiring within 90 days as warning', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-10-23' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('WARNING')
    expect(result.daysUntilExpiry).toBe(60)
  })
})
