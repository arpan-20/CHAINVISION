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
})
