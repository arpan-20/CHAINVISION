import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UpstreamServiceError, withRetry } from './rateLimitAwareRetry'

describe('withRetry', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it('retries rate-limited upstream calls up to the configured max', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new UpstreamServiceError('rate limited', 429))
      .mockRejectedValueOnce(new UpstreamServiceError('rate limited again', 429))
      .mockResolvedValueOnce('ok')

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1, label: 'test' })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('lets the final upstream error fall through after retries are exhausted', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new UpstreamServiceError('still rate limited', 429))

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1, label: 'test' })).rejects.toMatchObject({
      upstreamStatus: 429,
    })
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
