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

  it('throws on non-finite adjustmentPct', () => {
    expect(() => computeSensedDemand([{ skuId: 'sku-1', dcId: 'dc-1', historicalDemand: 100 }], NaN)).toThrow(
      'adjustmentPct must be a finite number',
    )
    expect(() => computeSensedDemand([{ skuId: 'sku-1', dcId: 'dc-1', historicalDemand: 100 }], Infinity)).toThrow(
      'adjustmentPct must be a finite number',
    )
  })

  it('throws on negative or non-finite historical demand', () => {
    expect(() =>
      computeSensedDemand([{ skuId: 'sku-1', dcId: 'dc-1', historicalDemand: -10 }], 0),
    ).toThrow('historicalDemand values must be finite, non-negative numbers')
    expect(() =>
      computeSensedDemand([{ skuId: 'sku-1', dcId: 'dc-1', historicalDemand: NaN }], 0),
    ).toThrow('historicalDemand values must be finite, non-negative numbers')
  })

  it('handles very large demand quantities without precision loss', () => {
    const [result] = computeSensedDemand(
      [{ skuId: 'sku-bulk', dcId: 'dc-1', historicalDemand: 1_000_000 }],
      10,
    )
    expect(result.adjustedDemand).toBe(1_100_000)
    expect(result.historicalAverageDemand).toBe(1_000_000)
  })

  it('handles single data point', () => {
    const [result] = computeSensedDemand(
      [{ skuId: 'sku-single', dcId: 'dc-1', historicalDemand: 50 }],
      20,
    )
    expect(result.historicalAverageDemand).toBe(50)
    expect(result.adjustedDemand).toBe(60)
    expect(result.sampleCount).toBe(1)
  })

  it('handles zero adjustment with single data point', () => {
    const [result] = computeSensedDemand(
      [{ skuId: 'sku-single', dcId: 'dc-1', historicalDemand: 75 }],
      0,
    )
    expect(result.adjustedDemand).toBe(75)
  })
})
