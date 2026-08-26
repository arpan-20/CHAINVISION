import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HOLDING_COST_PER_UNIT_PER_YEAR,
  DEFAULT_ORDER_COST,
  DEFAULT_SERVICE_LEVEL_Z_SCORE,
  computeEoq,
  computeReorderPoint,
  computeSafetyStock,
} from './replenishmentMathEngine'

describe('computeSafetyStock', () => {
  it('computes low-variability safety stock', () => {
    expect(computeSafetyStock({ demandStdDev: 5, leadTimeDays: 7 })).toBe(21.83)
  })

  it('computes medium-variability safety stock', () => {
    expect(computeSafetyStock({ demandStdDev: 12, leadTimeDays: 14 })).toBe(74.08)
  })

  it('computes high-variability safety stock with a custom z-score', () => {
    expect(
      computeSafetyStock({ demandStdDev: 20, leadTimeDays: 21, serviceLevelZScore: 2 }),
    ).toBe(183.3)
  })
})

describe('computeReorderPoint', () => {
  it('computes reorder point for short lead time', () => {
    expect(
      computeReorderPoint({ averageDailyDemand: 30, leadTimeDays: 7, safetyStock: 21.83 }),
    ).toBe(231.83)
  })

  it('computes reorder point for medium lead time', () => {
    expect(
      computeReorderPoint({ averageDailyDemand: 45, leadTimeDays: 14, safetyStock: 74.08 }),
    ).toBe(704.08)
  })

  it('computes reorder point for long lead time', () => {
    expect(
      computeReorderPoint({ averageDailyDemand: 65, leadTimeDays: 21, safetyStock: 183.3 }),
    ).toBe(1548.3)
  })
})

describe('computeEoq', () => {
  it('computes EOQ with default hackathon cost constants', () => {
    expect(computeEoq({ annualDemand: 10950 })).toBe(740)
  })

  it('computes EOQ with a custom order cost', () => {
    expect(computeEoq({ annualDemand: 16425, orderCost: 75 })).toBe(1110)
  })

  it('computes EOQ with custom order and holding costs', () => {
    expect(
      computeEoq({
        annualDemand: 23725,
        orderCost: 80,
        holdingCostPerUnitPerYear: 4,
      }),
    ).toBe(975)
  })

  it('exposes the default constants used by the formulas', () => {
    expect(DEFAULT_SERVICE_LEVEL_Z_SCORE).toBe(1.65)
    expect(DEFAULT_ORDER_COST).toBe(50)
    expect(DEFAULT_HOLDING_COST_PER_UNIT_PER_YEAR).toBe(2)
  })

  it('returns zero safety stock when demandStdDev is zero', () => {
    expect(computeSafetyStock({ demandStdDev: 0, leadTimeDays: 7 })).toBe(0)
  })

  it('throws on negative or non-finite inputs for safety stock', () => {
    expect(() =>
      computeSafetyStock({ demandStdDev: -5, leadTimeDays: 7 }),
    ).toThrow('demandStdDev must be a finite, non-negative number')
    expect(() =>
      computeSafetyStock({ demandStdDev: 5, leadTimeDays: -1 }),
    ).toThrow('leadTimeDays must be a finite, non-negative number')
    expect(() =>
      computeSafetyStock({ demandStdDev: 5, leadTimeDays: 7, serviceLevelZScore: -1 }),
    ).toThrow('serviceLevelZScore must be a finite, non-negative number')
  })

  it('returns zero reorder point when all inputs are zero', () => {
    expect(computeReorderPoint({ averageDailyDemand: 0, leadTimeDays: 0, safetyStock: 0 })).toBe(0)
  })

  it('throws on negative or non-finite inputs for reorder point', () => {
    expect(() =>
      computeReorderPoint({ averageDailyDemand: -10, leadTimeDays: 7, safetyStock: 21.83 }),
    ).toThrow('averageDailyDemand must be a finite, non-negative number')
    expect(() =>
      computeReorderPoint({ averageDailyDemand: 30, leadTimeDays: -1, safetyStock: 21.83 }),
    ).toThrow('leadTimeDays must be a finite, non-negative number')
    expect(() =>
      computeReorderPoint({ averageDailyDemand: 30, leadTimeDays: 7, safetyStock: -5 }),
    ).toThrow('safetyStock must be a finite, non-negative number')
  })

  it('returns zero EOQ when annual demand is zero', () => {
    expect(computeEoq({ annualDemand: 0 })).toBe(0)
  })

  it('throws on negative or zero order/holding costs for EOQ', () => {
    expect(() =>
      computeEoq({ annualDemand: 1000, orderCost: 0 }),
    ).toThrow('orderCost must be a finite number greater than zero')
    expect(() =>
      computeEoq({ annualDemand: 1000, orderCost: 50, holdingCostPerUnitPerYear: -2 }),
    ).toThrow('holdingCostPerUnitPerYear must be a finite number greater than zero')
  })

  it('computes EOQ correctly with non-default costs', () => {
    // Manual verification: sqrt((2 * 1000 * 100) / 5) = sqrt(40000) = 200
    expect(computeEoq({ annualDemand: 1000, orderCost: 100, holdingCostPerUnitPerYear: 5 })).toBe(200)
  })

  it('handles extremely large annual demand without overflow', () => {
    const result = computeEoq({ annualDemand: 1_000_000_000 })
    expect(result).toBeGreaterThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('computes safety stock with zero lead time', () => {
    expect(computeSafetyStock({ demandStdDev: 10, leadTimeDays: 0 })).toBe(0)
  })

  it('computes reorder point with zero lead time and zero demand', () => {
    expect(computeReorderPoint({ averageDailyDemand: 0, leadTimeDays: 0, safetyStock: 0 })).toBe(0)
  })

  it('computes reorder point with zero demand but positive lead time and safety stock', () => {
    expect(computeReorderPoint({ averageDailyDemand: 0, leadTimeDays: 7, safetyStock: 21.83 })).toBe(21.83)
  })
})
