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
})
