import express from 'express'
import http, { type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { UpstreamServiceError } from './rateLimitAwareRetry'
import { errorHandler } from './errorHandler'

describe('errorHandler', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    app.post('/validation', (req, _res, next) => {
      if (!req.body?.skuId) {
        next(Object.assign(new Error('skuId is required'), { statusCode: 400 }))
        return
      }
      next()
    })
    app.get('/missing', (_req, _res, next) => {
      next(Object.assign(new Error('Recommendation not found'), { statusCode: 404 }))
    })
    app.get('/upstream', (_req, _res, next) => {
      next(new UpstreamServiceError('Gemini call failed with 429: rate limited', 429))
    })
    app.get('/unexpected', () => {
      throw new Error('database password leaked in stack')
    })

    app.use(errorHandler)

    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))

    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
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

  it('returns structured validation errors', async () => {
    const response = await fetch(`${baseUrl}/validation`, { method: 'POST' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'skuId is required',
      },
    })
  })

  it('returns structured not-found errors', async () => {
    const response = await fetch(`${baseUrl}/missing`)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Recommendation not found',
      },
    })
  })

  it('returns structured upstream errors', async () => {
    const response = await fetch(`${baseUrl}/upstream`)

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: {
        code: 'UPSTREAM_SERVICE_ERROR',
        message: 'Gemini call failed with 429: rate limited',
      },
    })
  })

  it('does not leak unexpected error details', async () => {
    const response = await fetch(`${baseUrl}/unexpected`)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error occurred',
      },
    })
  })
})
