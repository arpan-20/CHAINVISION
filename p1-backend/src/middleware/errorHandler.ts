import type { ErrorRequestHandler } from 'express'

interface AppErrorLike {
  status?: number
  statusCode?: number
  code?: string
  isUpstreamError?: boolean
}

const statusFrom = (error: unknown): number => {
  if (typeof error !== 'object' || error === null) return 500

  const candidate = error as AppErrorLike
  const statusCode =
    typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : typeof candidate.status === 'number'
        ? candidate.status
        : undefined

  return statusCode && statusCode >= 400 && statusCode <= 599 ? statusCode : 500
}

const codeFor = (statusCode: number, error: unknown): string => {
  if (typeof error === 'object' && error !== null && typeof (error as AppErrorLike).code === 'string') {
    return (error as AppErrorLike).code as string
  }

  if (statusCode === 400) return 'VALIDATION_ERROR'
  if (statusCode === 401) return 'UNAUTHORIZED'
  if (statusCode === 404) return 'NOT_FOUND'
  if (statusCode === 415) return 'UNSUPPORTED_MEDIA_TYPE'
  if (statusCode === 502) return 'UPSTREAM_SERVICE_ERROR'
  return 'INTERNAL_ERROR'
}

const safeMessageFor = (statusCode: number, error: unknown): string => {
  if (statusCode >= 500 && statusCode !== 502) {
    return 'Unexpected error occurred'
  }

  if (statusCode === 502) {
    return error instanceof Error ? error.message : 'Upstream service failed'
  }

  return error instanceof Error ? error.message : 'Request failed'
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = statusFrom(error)
  const code = codeFor(statusCode, error)
  const message = safeMessageFor(statusCode, error)

  if (statusCode >= 500) {
    console.error('[errorHandler]', error)
  } else {
    console.warn('[errorHandler]', error instanceof Error ? error.message : error)
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  })
}
