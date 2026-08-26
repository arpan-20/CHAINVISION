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

  it('marks exactly 30 days out as critical (boundary)', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-09-23' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('CRITICAL')
    expect(result.daysUntilExpiry).toBe(30)
  })

  it('marks exactly 31 days out as warning (boundary)', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-09-24' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('WARNING')
    expect(result.daysUntilExpiry).toBe(31)
  })

  it('marks exactly 90 days out as warning (boundary)', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-11-22' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('WARNING')
    expect(result.daysUntilExpiry).toBe(90)
  })

  it('marks exactly 91 days out as ok (boundary)', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, expiryDate: '2026-11-23' }],
      '2026-08-24',
    )

    expect(result.expiryRisk).toBe('OK')
    expect(result.daysUntilExpiry).toBe(91)
  })

  it('throws on negative or non-finite batch quantity', () => {
    expect(() =>
      scoreExpiryRisk([{ ...baseBatch, quantity: -5 }], '2026-08-24'),
    ).toThrow('Batch quantity values must be finite, non-negative numbers')
    expect(() =>
      scoreExpiryRisk([{ ...baseBatch, quantity: NaN }], '2026-08-24'),
    ).toThrow('Batch quantity values must be finite, non-negative numbers')
  })

  it('handles multiple batches with mixed risk levels', () => {
    const results = scoreExpiryRisk(
      [
        { ...baseBatch, id: 'b1', expiryDate: '2026-08-20' }, // EXPIRED
        { ...baseBatch, id: 'b2', expiryDate: '2026-08-26' }, // CRITICAL (2 days)
        { ...baseBatch, id: 'b3', expiryDate: '2026-09-23' }, // CRITICAL (30 days)
        { ...baseBatch, id: 'b4', expiryDate: '2026-10-24' }, // WARNING (61 days)
        { ...baseBatch, id: 'b5', expiryDate: '2026-12-01' }, // OK (99 days)
      ],
      '2026-08-24',
    )

    expect(results.map((r) => r.expiryRisk)).toEqual(['EXPIRED', 'CRITICAL', 'CRITICAL', 'WARNING', 'OK'])
  })

  it('handles very large batch quantities', () => {
    const [result] = scoreExpiryRisk(
      [{ ...baseBatch, quantity: 10_000_000, expiryDate: '2026-09-23' }],
      '2026-08-24',
    )
    expect(result.expiryRisk).toBe('CRITICAL')
    expect(result.daysUntilExpiry).toBe(30)
  })

  it('handles empty batch list', () => {
    const results = scoreExpiryRisk([], '2026-08-24')
    expect(results).toEqual([])
  })
})
