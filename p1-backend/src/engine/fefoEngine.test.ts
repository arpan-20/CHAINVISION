import { describe, expect, it } from 'vitest'

import { planFefoAllocation, sequenceFefo, type FefoBatch } from './fefoEngine'

const batch = (overrides: Partial<FefoBatch>): FefoBatch => ({
  id: 'batch-base',
  skuId: 'sku-1',
  dcId: 'dc-1',
  batchNo: 'BASE',
  quantity: 100,
  expiryDate: '2026-12-31',
  receivedDate: '2026-06-01',
  ...overrides,
})

describe('sequenceFefo', () => {
  it('orders mixed batches by soonest expiry first', () => {
    const result = sequenceFefo([
      batch({ id: 'b-3', batchNo: 'B3', expiryDate: '2026-12-31' }),
      batch({ id: 'b-1', batchNo: 'B1', expiryDate: '2026-09-01' }),
      batch({ id: 'b-2', batchNo: 'B2', expiryDate: '2026-10-15' }),
    ])

    expect(result.map((item) => item.id)).toEqual(['b-1', 'b-2', 'b-3'])
    expect(result.map((item) => item.allocationRank)).toEqual([1, 2, 3])
  })

  it('uses batch number as a deterministic tie-breaker for same expiry date', () => {
    const result = sequenceFefo([
      batch({ id: 'b-2', batchNo: 'LOT-B', expiryDate: '2026-09-01' }),
      batch({ id: 'b-1', batchNo: 'LOT-A', expiryDate: '2026-09-01' }),
    ])

    expect(result.map((item) => item.batchNo)).toEqual(['LOT-A', 'LOT-B'])
  })

  it('does not mutate the original batch list', () => {
    const batches = [
      batch({ id: 'later', batchNo: 'LATER', expiryDate: '2026-12-31' }),
      batch({ id: 'earlier', batchNo: 'EARLIER', expiryDate: '2026-09-01' }),
    ]

    sequenceFefo(batches)

    expect(batches.map((item) => item.id)).toEqual(['later', 'earlier'])
  })

  it('handles a single batch correctly', () => {
    const result = sequenceFefo([
      batch({ id: 'only', batchNo: 'ONLY', expiryDate: '2026-09-01', quantity: 50 }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].allocationRank).toBe(1)
    expect(result[0].id).toBe('only')
  })

  it('throws on negative or non-finite batch quantity', () => {
    expect(() =>
      sequenceFefo([batch({ id: 'bad', quantity: -1 })]),
    ).toThrow('Batch quantity values must be finite, non-negative numbers')
    expect(() =>
      sequenceFefo([batch({ id: 'bad', quantity: NaN })]),
    ).toThrow('Batch quantity values must be finite, non-negative numbers')
  })

  it('throws on invalid ISO date format', () => {
    expect(() =>
      sequenceFefo([batch({ id: 'bad', expiryDate: 'not-a-date' })]),
    ).toThrow('Invalid ISO date')
  })

  it('sorts by expiry date then batchNo only (receivedDate not used as tertiary sort - known gap)', () => {
    const result = sequenceFefo([
      batch({ id: 'b1', batchNo: 'SAME', expiryDate: '2026-09-01', receivedDate: '2026-06-10' }),
      batch({ id: 'b2', batchNo: 'SAME', expiryDate: '2026-09-01', receivedDate: '2026-06-01' }),
    ])

    // Current implementation only sorts by expiryDate then batchNo; receivedDate is not a tie-breaker
    // This is a known implementation gap - see engines.coverage.md
    expect(result.map((r) => r.id)).toEqual(['b1', 'b2'])
  })

  it('handles very large batch quantities without precision issues', () => {
    const result = sequenceFefo([
      batch({ id: 'b1', quantity: 1_000_000, expiryDate: '2026-09-01' }),
      batch({ id: 'b2', quantity: 2_000_000, expiryDate: '2026-09-02' }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0].quantity).toBe(1_000_000)
    expect(result[1].quantity).toBe(2_000_000)
  })

  it('handles empty batch list', () => {
    const result = sequenceFefo([])
    expect(result).toEqual([])
  })
})

describe('planFefoAllocation', () => {
  it('allocates requested quantity from earliest-expiring batches first', () => {
    const result = planFefoAllocation(
      [
        batch({ id: 'b-3', batchNo: 'B3', quantity: 60, expiryDate: '2026-12-31' }),
        batch({ id: 'b-1', batchNo: 'B1', quantity: 40, expiryDate: '2026-09-01' }),
        batch({ id: 'b-2', batchNo: 'B2', quantity: 50, expiryDate: '2026-10-15' }),
      ],
      75,
    )

    expect(result).toMatchObject([
      { batchId: 'b-1', allocatedQuantity: 40, allocationRank: 1 },
      { batchId: 'b-2', allocatedQuantity: 35, allocationRank: 2 },
    ])
  })

  it('returns empty allocation when requested quantity is zero', () => {
    const result = planFefoAllocation(
      [batch({ id: 'b-1', quantity: 100, expiryDate: '2026-09-01' })],
      0,
    )

    expect(result).toEqual([])
  })

  it('throws on negative or non-finite requested quantity', () => {
    expect(() =>
      planFefoAllocation([batch({ id: 'b-1', quantity: 100 })], -10),
    ).toThrow('requestedQuantity must be a finite, non-negative number')
    expect(() =>
      planFefoAllocation([batch({ id: 'b-1', quantity: 100 })], NaN),
    ).toThrow('requestedQuantity must be a finite, non-negative number')
  })

  it('allocates all available when requested exceeds total supply', () => {
    const result = planFefoAllocation(
      [
        batch({ id: 'b-1', quantity: 40, expiryDate: '2026-09-01' }),
        batch({ id: 'b-2', quantity: 30, expiryDate: '2026-10-01' }),
      ],
      200,
    )

    expect(result).toMatchObject([
      { batchId: 'b-1', allocatedQuantity: 40, allocationRank: 1 },
      { batchId: 'b-2', allocatedQuantity: 30, allocationRank: 2 },
    ])
    expect(result.reduce((sum, a) => sum + a.allocatedQuantity, 0)).toBe(70)
  })

  it('filters out zero-quantity allocations when a batch has zero quantity', () => {
    const result = planFefoAllocation(
      [
        batch({ id: 'b-1', quantity: 0, expiryDate: '2026-09-01' }),
        batch({ id: 'b-2', quantity: 50, expiryDate: '2026-10-01' }),
      ],
      30,
    )

    expect(result).toHaveLength(1)
    expect(result[0].batchId).toBe('b-2')
    expect(result[0].allocatedQuantity).toBe(30)
  })
})
