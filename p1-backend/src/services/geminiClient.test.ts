import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('geminiClient', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.GEMINI_MODEL = 'gemini-test-model'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_MODEL
  })

  it('retries Gemini 429 responses twice, then lets the error fall through', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'quota exceeded',
    } as Response)
    global.fetch = fetchMock

    const { generateText } = await import('./geminiClient.js')

    await expect(generateText('Describe the already-computed recommendation.')).rejects.toMatchObject({
      upstreamStatus: 429,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
