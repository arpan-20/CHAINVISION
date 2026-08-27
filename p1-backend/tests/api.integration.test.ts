import http, { type Server } from 'node:http'
import { AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockData = vi.hoisted(() => ({
  skus: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      sku_code: 'MED-104',
      name: 'Oseltamivir 75mg',
      category: 'cold/flu',
      unit_cost: 8.75,
      lead_time_days: 14,
    },
  ],
  distributionCenters: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      dc_code: 'DC-PAT',
      name: 'Patna Regional DC',
      region: 'tier-2',
      capacity_units: 55000,
    },
  ],
  inventoryBatches: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      sku_id: '11111111-1111-4111-8111-111111111111',
      dc_id: '22222222-2222-4222-8222-222222222222',
      batch_no: 'MED-104-DC-PAT-A',
      quantity: 180,
      expiry_date: '2026-09-10',
      received_date: '2026-06-10',
    },
  ],
  demandSignals: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      sku_id: '11111111-1111-4111-8111-111111111111',
      dc_id: '22222222-2222-4222-8222-222222222222',
      signal_date: '2026-08-24',
      historical_demand: 50,
      sensed_adjustment_pct: 60,
      source: 'seasonal',
    },
  ],
  recommendations: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      sku_id: '11111111-1111-4111-8111-111111111111',
      dc_id: '22222222-2222-4222-8222-222222222222',
      recommended_qty: 1200,
      reorder_point: 780,
      safety_stock: 80,
      eoq: 1200,
      urgency: 'HIGH',
      reason_code: 'REORDER_POINT_BREACHED',
      ai_rationale: '',
      status: 'NEW',
      created_at: '2026-08-24T09:00:00.000Z',
    },
  ],
}))

const TEST_USER = {
  id: '99999999-a1a1-4a1a-8a1a-aaaaaaaaaaaa',
  email: 'planner@test.local',
  role: 'PLANNER' as const,
}

const generateReplenishmentRecommendations = vi.hoisted(() => vi.fn())

class MockSupabaseQuery {
  private readonly table: string
  private filters: Array<{ column: string; value: unknown }> = []
  private insertedRow: Record<string, unknown> | null = null

  constructor(table: string) {
    this.table = table
  }

  select(): this {
    return this
  }

  order(): this {
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value })
    return this
  }

  insert(row: Record<string, unknown>): this {
    this.insertedRow = row
    return this
  }

  async single(): Promise<{ data: unknown; error: null }> {
    if (this.table === 'demand_signals' && this.insertedRow) {
      const row = {
        id: '66666666-6666-4666-8666-666666666666',
        ...this.insertedRow,
      }
      mockData.demandSignals.unshift(row as (typeof mockData.demandSignals)[number])

      return { data: row, error: null }
    }

    return { data: this.filteredRows()[0] ?? null, error: null }
  }

  async maybeSingle(): Promise<{ data: unknown | null; error: null }> {
    return { data: this.filteredRows()[0] ?? null, error: null }
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.filteredRows(), error: null }).then(
      onfulfilled,
      onrejected,
    )
  }

  private filteredRows(): unknown[] {
    return this.rowsForTable().filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value),
    )
  }

  private rowsForTable(): Array<Record<string, unknown>> {
    if (this.table === 'users') {
      return [{ id: TEST_USER.id, email: TEST_USER.email, role: TEST_USER.role }]
    }

    if (this.table === 'skus') {
      return mockData.skus
    }

    if (this.table === 'distribution_centers') {
      return mockData.distributionCenters
    }

    if (this.table === 'inventory_batches') {
      return mockData.inventoryBatches
    }

    if (this.table === 'demand_signals') {
      return mockData.demandSignals
    }

    if (this.table === 'replenishment_recommendations') {
      return mockData.recommendations
    }

    throw new Error(`Unexpected Supabase table in test: ${this.table}`)
  }
}

vi.mock('../src/db/supabaseClient', () => ({
  supabaseClient: {
    auth: {
      // Phase 23 JWT verification path: any non-empty token authenticates as TEST_USER
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid-test-token') {
          return { data: { user: { id: TEST_USER.id, email: TEST_USER.email } }, error: null }
        }

        return { data: { user: null }, error: new Error('Invalid token') }
      }),
    },
    schema: vi.fn(() => ({
      from: (table: string) => new MockSupabaseQuery(table),
    })),
    // verifySupabaseJwt reads the shared users profile without schema('public')
    from: (table: string) => new MockSupabaseQuery(table),
  },
}))

vi.mock('../src/services/recommendationService', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/services/recommendationService')>()

  return {
    ...original,
    generateReplenishmentRecommendations,
  }
})

const requestJson = async (
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; body: unknown }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer valid-test-token',
      ...options.headers,
    },
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

describe('P1 API routes', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.P1_PORT = '4000'
    process.env.PR2_BASE_URL = 'http://localhost:8080'
    process.env.INTERNAL_API_KEY = 'test-internal-key'

    const { app } = await import('../src/index')
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))

    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  beforeEach(() => {
    generateReplenishmentRecommendations.mockReset()
    generateReplenishmentRecommendations.mockResolvedValue([
      {
        recommendationId: '77777777-7777-4777-8777-777777777777',
        skuId: '11111111-1111-4111-8111-111111111111',
        skuName: 'Oseltamivir 75mg',
        dcId: '22222222-2222-4222-8222-222222222222',
        recommendedQty: 1200,
        urgency: 'HIGH',
        reason: 'REORDER_POINT_BREACHED',
        aiRationale: '',
        expiryRiskContext: 'critical=1',
        generatedAt: '2026-08-24T09:00:00.000Z',
      },
      {
        recommendationId: '88888888-8888-4888-8888-888888888888',
        skuId: '11111111-1111-4111-8111-111111111111',
        skuName: 'Oseltamivir 75mg',
        dcId: '22222222-2222-4222-8222-222222222222',
        recommendedQty: 900,
        urgency: 'MEDIUM',
        reason: 'LOW_COVER',
        aiRationale: '',
        expiryRiskContext: 'warning=1',
        generatedAt: '2026-08-24T09:00:00.000Z',
      },
    ])
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  it('lists SKUs and distribution centers', async () => {
    const skus = await requestJson(baseUrl, '/api/skus')
    const dcs = await requestJson(baseUrl, '/api/distribution-centers')

    expect(skus.status).toBe(200)
    expect(skus.body).toMatchObject({
      data: [{ skuCode: 'MED-104', leadTimeDays: 14 }],
    })
    expect(dcs.status).toBe(200)
    expect(dcs.body).toMatchObject({
      data: [{ dcCode: 'DC-PAT', region: 'tier-2' }],
    })
  })

  it('covers inventory and demand signal routes', async () => {
    const inventory = await requestJson(baseUrl, '/api/inventory?detail=batches')
    const demandSignals = await requestJson(baseUrl, '/api/demand-signals')
    const createdDemandSignal = await requestJson(baseUrl, '/api/demand-signals', {
      method: 'POST',
      body: JSON.stringify({
        skuId: '11111111-1111-4111-8111-111111111111',
        dcId: '22222222-2222-4222-8222-222222222222',
        historicalDemand: 75,
        sensedAdjustmentPct: 60,
        source: 'seasonal',
      }),
    })

    expect(inventory.status).toBe(200)
    expect(inventory.body).toMatchObject({
      data: {
        stock: [{ currentStock: 180, batchCount: 1 }],
        batches: [{ batchNo: 'MED-104-DC-PAT-A' }],
      },
    })
    expect(demandSignals.status).toBe(200)
    expect(demandSignals.body).toMatchObject({
      data: [{ historicalDemand: 50, sensedAdjustmentPct: 60 }],
    })
    expect(createdDemandSignal.status).toBe(201)
    expect(createdDemandSignal.body).toMatchObject({
      data: { historicalDemand: 75, sensedAdjustmentPct: 60 },
    })
  })

  it('recalculates and summarizes replenishment recommendations', async () => {
    const response = await requestJson(baseUrl, '/api/replenishment/recalculate', {
      method: 'POST',
      body: JSON.stringify({
        skuId: '11111111-1111-4111-8111-111111111111',
        dcId: '22222222-2222-4222-8222-222222222222',
        today: '2026-08-24',
      }),
    })

    expect(response.status).toBe(201)
    expect(generateReplenishmentRecommendations).toHaveBeenCalledWith({
      skuId: '11111111-1111-4111-8111-111111111111',
      dcId: '22222222-2222-4222-8222-222222222222',
      today: '2026-08-24',
    })
    expect(response.body).toMatchObject({
      data: {
        count: 2,
        byUrgency: { LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 0 },
      },
    })
  })

  it('lists replenishment recommendations and returns one by id', async () => {
    const list = await requestJson(
      baseUrl,
      '/api/replenishment/recommendations?urgency=HIGH&status=NEW',
    )
    const byId = await requestJson(
      baseUrl,
      '/api/replenishment/recommendations/55555555-5555-4555-8555-555555555555',
    )

    expect(list.status).toBe(200)
    expect(list.body).toMatchObject({
      data: [{ id: '55555555-5555-4555-8555-555555555555', urgency: 'HIGH' }],
    })
    expect(byId.status).toBe(200)
    expect(byId.body).toMatchObject({
      data: {
        id: '55555555-5555-4555-8555-555555555555',
        recommendedQty: 1200,
      },
    })
  })

  it('returns 404 for an unknown recommendation id', async () => {
    const response = await requestJson(
      baseUrl,
      '/api/replenishment/recommendations/99999999-9999-4999-8999-999999999999',
    )

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Replenishment recommendation not found' })
  })
})
