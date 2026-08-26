export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  label?: string
}

export class UpstreamServiceError extends Error {
  statusCode = 502
  code = 'UPSTREAM_SERVICE_ERROR'
  upstreamStatus?: number

  constructor(message: string, upstreamStatus?: number) {
    super(message)
    this.name = 'UpstreamServiceError'
    this.upstreamStatus = upstreamStatus
  }
}

const sleep = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs))

const statusFrom = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined

  const maybeError = error as { status?: unknown; statusCode?: unknown; upstreamStatus?: unknown }
  if (typeof maybeError.upstreamStatus === 'number') return maybeError.upstreamStatus
  if (typeof maybeError.status === 'number') return maybeError.status
  if (typeof maybeError.statusCode === 'number') return maybeError.statusCode

  return undefined
}

export const isRetryableUpstreamError = (error: unknown): boolean => {
  const status = statusFrom(error)
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
    return true
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('rate limit') || message.includes('timeout') || message.includes('network')
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  { maxRetries = 2, baseDelayMs = 500, label = 'upstream call' }: RetryOptions = {},
): Promise<T> => {
  let attempt = 0

  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableUpstreamError(error)) {
        throw error
      }

      attempt += 1
      const jitterMs = Math.floor(Math.random() * baseDelayMs)
      const delayMs = baseDelayMs * 2 ** (attempt - 1) + jitterMs

      console.warn(
        `[rateLimitAwareRetry] ${label} failed; retry ${attempt}/${maxRetries} in ${delayMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      await sleep(delayMs)
    }
  }
}
