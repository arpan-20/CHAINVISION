import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listDemandSignals: vi.fn(),
  listInventoryBatches: vi.fn(),
  sendRecommendation: vi.fn(),
  insertedRows: [] as Array<Record<string, unknown>>,
  statusUpdates: [] as Array<{ id: string; status: string }>,
}))

vi.mock('../src/services/demandService', () => ({
  listDemandSignals: mocks.listDemandSignals,
}))

vi.mock('../src/services/inventoryService', () => ({
  listInventoryBatches: mocks.listInventoryBatches,
}))

vi.mock('../src/services/pr2ClientService', () => ({
  sendRecommendation: mocks.sendRecommendation,
}))

vi.mock('../src/db/supabaseClient', () => ({
  supabaseClient: {
    schema: vi.fn(() => ({
      from: (table: string) => {
        if (table === 'skus') {
          return {
            select: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'sku-critical',
                    name: 'Oseltamivir 75mg',
                    lead_time_days: 10,
                  },
                ],
                error: null,
              }),
            ),
          }
        }

        if (table === 'replenishment_recommendations') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              mocks.insertedRows.push(row)

              return {
                select: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: {
                        id: 'recommendation-1',
                        ...row,
                        created_at: '2026-08-24T09:00:00.000Z',
                      },
                      error: null,
                    }),
                  ),
                })),
              }
            }),
            update: vi.fn((row: { status: string }) => ({
              eq: vi.fn((_: string, id: string) => {
                mocks.statusUpdates.push({ id, status: row.status })
                return Promise.resolve({ error: null })
              }),
            })),
          }
        }

        throw new Error(`Unexpected table in test: ${table}`)
      },
    })),
  },
}))

import { generateReplenishmentRecommendations } from '../src/services/recommendationService'

const criticalDemandSignal = {
  id: 'demand-1',
  skuId: 'sku-critical',
  dcId: 'dc-pat',
  signalDate: '2026-08-24',
  historicalDemand: 30,
  sensedAdjustmentPct: 60,
  source: 'seasonal',
}

const criticalInventoryBatch = {
  id: 'batch-1',
  skuId: 'sku-critical',
  dcId: 'dc-pat',
  batchNo: 'CRIT-A',
  quantity: 100,
  expiryDate: '2026-09-01',
  receivedDate: '2026-06-01',
}

describe('P1 to PR2 replenishment handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedRows.length = 0
    mocks.statusUpdates.length = 0
    mocks.listDemandSignals.mockResolvedValue([criticalDemandSignal])
    mocks.listInventoryBatches.mockResolvedValue([criticalInventoryBatch])
  })

  it('sends the generated contract to PR2 and marks it SENT_TO_PROCUREMENT', async () => {
    mocks.sendRecommendation.mockResolvedValue(undefined)

    const [recommendation] = await generateReplenishmentRecommendations({
      today: '2026-08-24',
    })

    expect(mocks.sendRecommendation).toHaveBeenCalledTimes(1)
    expect(mocks.sendRecommendation).toHaveBeenCalledWith(recommendation)
    expect(recommendation).toMatchObject({
      recommendationId: 'recommendation-1',
      skuId: 'sku-critical',
      skuName: 'Oseltamivir 75mg',
      dcId: 'dc-pat',
      urgency: 'CRITICAL',
      reason: 'STOCKOUT_RISK',
    })
    expect(mocks.statusUpdates).toEqual([
      { id: 'recommendation-1', status: 'SENT_TO_PROCUREMENT' },
    ])
  })

  it('keeps the database status NEW when PR2 rejects the handoff', async () => {
    mocks.sendRecommendation.mockRejectedValue(new Error('PR2 is unavailable'))

    const recommendations = await generateReplenishmentRecommendations({
      today: '2026-08-24',
    })

    expect(recommendations).toHaveLength(1)
    expect(mocks.sendRecommendation).toHaveBeenCalledTimes(1)
    expect(mocks.statusUpdates).toEqual([])
    expect(mocks.insertedRows[0]).toMatchObject({ status: 'NEW' })
  })
})