import { describe, expect, it } from 'vitest'

import { computeSensedDemand } from './demandEngine'

describe('computeSensedDemand', () => {
  it('keeps flat demand unchanged with a zero adjustment', () => {
    expect(
      computeSensedDemand(
        [
          { skuId: 'sku-1', dcId: 'dc-1', historicalDemand: 100 },
          { skuId: 'sku-1', dcId: 'dc-1', historicalDemand: 100 },
          { skuId: 'sku-1', dcId: 'dc-1', historicalDemand: 100 },
        ],
        0,
      ),
    ).toEqual([
      {
        skuId: 'sku-1',
        dcId: 'dc-1',
        historicalAverageDemand: 100,
        adjustmentPct: 0,
        adjustedDemand: 100,
        sampleCount: 3,
      },
    ])
  })

  it('applies a seasonal spike adjustment', () => {
    const [result] = computeSensedDemand(
      [
        { skuId: 'sku-flu', dcId: 'dc-tier-2', historicalDemand: 120 },
        { skuId: 'sku-flu', dcId: 'dc-tier-2', historicalDemand: 130 },
      ],
      60,
    )

    expect(result.adjustedDemand).toBe(200)
  })

  it('applies a demand decline adjustment without going negative', () => {
    const [result] = computeSensedDemand(
      [
        { skuId: 'sku-2', dcId: 'dc-1', historicalDemand: 80 },
        { skuId: 'sku-2', dcId: 'dc-1', historicalDemand: 100 },
      ],
      -25,
    )

    expect(result).toMatchObject({
      historicalAverageDemand: 90,
      adjustedDemand: 68,
    })
  })

  it('returns no results for a zero historical data series', () => {
    expect(computeSensedDemand([], 60)).toEqual([])
  })

  it('groups demand by SKU and DC', () => {
    const results = computeSensedDemand(
      [
        { skuId: 'sku-1', dcId: 'dc-1', historicalDemand: 10 },
        { skuId: 'sku-1', dcId: 'dc-2', historicalDemand: 20 },
      ],
      10,
    )

    expect(results).toHaveLength(2)
    expect(results.map((result) => result.adjustedDemand)).toEqual([11, 22])
  })
})
