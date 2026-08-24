import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode =
    typeof error?.statusCode === 'number'
      ? error.statusCode
      : typeof error?.status === 'number'
        ? error.status
        : 500

  const message = error instanceof Error ? error.message : 'Internal server error'

  res.status(statusCode).json({ error: message })
}