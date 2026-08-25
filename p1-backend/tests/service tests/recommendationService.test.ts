import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listDemandSignals: vi.fn(),
  listInventoryBatches: vi.fn(),
  insertedRows: [] as Array<Record<string, unknown>>,
  skuRows: [] as Array<{ id: string; name: string; lead_time_days: number }>,
}))

vi.mock('./demandService', () => ({
  listDemandSignals: mocks.listDemandSignals,
}))

vi.mock('./inventoryService', () => ({
  listInventoryBatches: mocks.listInventoryBatches,
}))

vi.mock('../db/supabaseClient', () => ({
  supabaseClient: {
    schema: vi.fn(() => ({
      from: (table: string) => {
        if (table === 'skus') {
          return {
            select: vi.fn(() =>
              Promise.resolve({
                data: mocks.skuRows,
                error: null,
              }),
            ),
          }
        }

        if (table === 'replenishment_recommendations') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              mocks.insertedRows.push(row)
              const id = `recommendation-${mocks.insertedRows.length}`

              return {
                select: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: {
                        id,
                        ...row,
                        created_at: '2026-08-24T09:00:00.000Z',
                      },
                      error: null,
                    }),
                  ),
                })),
              }
            }),
          }
        }

        throw new Error(`Unexpected table in test: ${table}`)
      },
    })),
  },
}))

import { generateReplenishmentRecommendations } from './recommendationService'

describe('generateReplenishmentRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedRows.length = 0
    mocks.skuRows = [
      { id: 'sku-critical', name: 'Oseltamivir 75mg', lead_time_days: 10 },
      { id: 'sku-high', name: 'Cetirizine 10mg', lead_time_days: 14 },
      { id: 'sku-medium', name: 'Guaifenesin Syrup', lead_time_days: 14 },
      { id: 'sku-ok', name: 'Aspirin 75mg', lead_time_days: 8 },
    ]
  })

  it('creates recommendation rows with varied deterministic urgencies', async () => {
    mocks.listDemandSignals.mockResolvedValue([
      {
        id: 'demand-1',
        skuId: 'sku-critical',
        dcId: 'dc-pat',
        signalDate: '2026-08-24',
        historicalDemand: 30,
        sensedAdjustmentPct: 60,
        source: 'seasonal',
      },
      {
        id: 'demand-2',
        skuId: 'sku-high',
        dcId: 'dc-guw',
        signalDate: '2026-08-24',
        historicalDemand: 45,
        sensedAdjustmentPct: 0,
        source: 'historical',
      },
      {
        id: 'demand-3',
        skuId: 'sku-medium',
        dcId: 'dc-pat',
        signalDate: '2026-08-24',
        historicalDemand: 50,
        sensedAdjustmentPct: 0,
        source: 'historical',
      },
      {
        id: 'demand-4',
        skuId: 'sku-ok',
        dcId: 'dc-mum',
        signalDate: '2026-08-24',
        historicalDemand: 20,
        sensedAdjustmentPct: 0,
        source: 'historical',
      },
    ])
    mocks.listInventoryBatches.mockResolvedValue([
      {
        id: 'batch-critical',
        skuId: 'sku-critical',
        dcId: 'dc-pat',
        batchNo: 'CRIT-A',
        quantity: 100,
        expiryDate: '2026-09-01',
        receivedDate: '2026-06-01',
      },
      {
        id: 'batch-high',
        skuId: 'sku-high',
        dcId: 'dc-guw',
        batchNo: 'HIGH-A',
        quantity: 500,
        expiryDate: '2027-01-01',
        receivedDate: '2026-06-01',
      },
      {
        id: 'batch-medium',
        skuId: 'sku-medium',
        dcId: 'dc-pat',
        batchNo: 'MED-A',
        quantity: 1000,
        expiryDate: '2027-01-01',
        receivedDate: '2026-06-01',
      },
      {
        id: 'batch-ok',
        skuId: 'sku-ok',
        dcId: 'dc-mum',
        batchNo: 'OK-A',
        quantity: 1000,
        expiryDate: '2027-01-01',
        receivedDate: '2026-06-01',
      },
    ])

    const recommendations = await generateReplenishmentRecommendations({
      today: '2026-08-24',
    })

    expect(recommendations).toHaveLength(3)
    expect(recommendations.map((recommendation) => recommendation.urgency)).toEqual([
      'CRITICAL',
      'HIGH',
      'MEDIUM',
    ])
    expect(mocks.insertedRows).toHaveLength(3)
    expect(mocks.insertedRows.map((row) => row.status)).toEqual(['NEW', 'NEW', 'NEW'])
  })

  it('returns the exact Phase 4 contract shape with blank AI rationale', async () => {
    mocks.listDemandSignals.mockResolvedValue([
      {
        id: 'demand-1',
        skuId: 'sku-critical',
        dcId: 'dc-pat',
        signalDate: '2026-08-24',
        historicalDemand: 30,
        sensedAdjustmentPct: 60,
        source: 'seasonal',
      },
    ])
    mocks.listInventoryBatches.mockResolvedValue([
      {
        id: 'batch-critical',
        skuId: 'sku-critical',
        dcId: 'dc-pat',
        batchNo: 'CRIT-A',
        quantity: 100,
        expiryDate: '2026-09-01',
        receivedDate: '2026-06-01',
      },
    ])

    const [recommendation] = await generateReplenishmentRecommendations({
      skuId: 'sku-critical',
      dcId: 'dc-pat',
      today: '2026-08-24',
    })

    expect(Object.keys(recommendation).sort()).toEqual(
      [
        'recommendationId',
        'skuId',
        'skuName',
        'dcId',
        'recommendedQty',
        'urgency',
        'reason',
        'aiRationale',
        'expiryRiskContext',
        'generatedAt',
      ].sort(),
    )
    expect(recommendation).toMatchObject({
      recommendationId: 'recommendation-1',
      skuId: 'sku-critical',
      skuName: 'Oseltamivir 75mg',
      dcId: 'dc-pat',
      recommendedQty: expect.any(Number),
      urgency: 'CRITICAL',
      reason: 'STOCKOUT_RISK',
      aiRationale: '',
      expiryRiskContext: 'expired=0; critical=1; warning=0; ok=0; firstFefoBatch=CRIT-A',
      generatedAt: '2026-08-24T09:00:00.000Z',
    })
  })
})
