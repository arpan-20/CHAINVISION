import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}))

vi.mock('./geminiClient', () => ({
  generateText: mocks.generateText,
}))

import { fallbackRationale, generateRationale, type RationaleInput } from './aiRationaleService'

const input: RationaleInput = {
  skuName: 'Oseltamivir 75mg',
  dcId: 'dc-pat',
  recommendedQty: 510,
  urgency: 'CRITICAL',
  reasonCode: 'STOCKOUT_RISK',
  currentStock: 100,
  daysOfCover: 2.1,
  reorderPoint: 480,
  safetyStock: 42,
  eoq: 510,
  leadTimeDays: 10,
  expiryRiskContext: 'expired=0; critical=1; warning=0; ok=0; firstFefoBatch=CRIT-A',
}

describe('generateRationale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns Gemini text when available', async () => {
    mocks.generateText.mockResolvedValue(
      'Recommended 510 units for dc-pat because stock cover is below the 10-day lead time.',
    )

    await expect(generateRationale(input)).resolves.toBe(
      'Recommended 510 units for dc-pat because stock cover is below the 10-day lead time.',
    )
    expect(mocks.generateText).toHaveBeenCalledTimes(1)
    expect(mocks.generateText.mock.calls[0][0]).toContain('Recommended quantity: 510')
    expect(mocks.generateText.mock.calls[0][0]).toContain('Urgency: CRITICAL')
  })

  it('falls back to a deterministic rationale when Gemini fails', async () => {
    mocks.generateText.mockRejectedValue(new Error('rate limited'))

    const rationale = await generateRationale(input)

    expect(rationale).toBe(fallbackRationale(input))
    expect(rationale).toContain('Recommended 510 units for dc-pat')
    expect(rationale).toContain('current stock is 100 units')
    expect(rationale).toContain('reorder point 480')
  })
})
