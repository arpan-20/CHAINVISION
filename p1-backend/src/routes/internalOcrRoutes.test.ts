import express from 'express'
import http, { type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const extractText = vi.hoisted(() => vi.fn())

vi.mock('../services/ocrService', () => ({
  extractText,
}))

const requestMultipart = async (
  baseUrl: string,
  path: string,
  options: { internalKey?: string } = {},
): Promise<{ status: number; body: unknown }> => {
  const formData = new FormData()
  formData.append(
    'file',
    new Blob(['invoice INV-1001 qty 500 total 5000'], { type: 'image/png' }),
    'invoice.png',
  )

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: options.internalKey ? { 'x-internal-key': options.internalKey } : undefined,
    body: formData,
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

describe('internal OCR routes', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.P1_PORT = '4000'
    process.env.PR2_BASE_URL = 'http://localhost:8080'
    process.env.INTERNAL_API_KEY = 'test-internal-key'

    const { internalOcrRoutes } = await import('./internalOcrRoutes.js')
    const app = express()
    app.use(internalOcrRoutes)
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))

    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  beforeEach(() => {
    extractText.mockReset()
    extractText.mockResolvedValue('invoice INV-1001 qty 500 total 5000')
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

  it('rejects requests missing the internal key', async () => {
    const response = await requestMultipart(baseUrl, '/internal/ocr/extract')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Invalid internal API key' })
    expect(extractText).not.toHaveBeenCalled()
  })

  it('returns raw OCR text for authorized multipart uploads', async () => {
    const response = await requestMultipart(baseUrl, '/internal/ocr/extract', {
      internalKey: 'test-internal-key',
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ rawText: 'invoice INV-1001 qty 500 total 5000' })
    expect(extractText).toHaveBeenCalledWith(expect.any(Buffer), 'image/png')
  })
})
