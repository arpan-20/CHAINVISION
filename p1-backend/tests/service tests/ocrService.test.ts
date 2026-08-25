import { beforeEach, describe, expect, it, vi } from 'vitest'

const recognize = vi.hoisted(() => vi.fn())
const pdf = vi.hoisted(() => vi.fn())
const destroy = vi.hoisted(() => vi.fn())

vi.mock('tesseract.js', () => ({
  recognize,
}))

vi.mock('pdf-to-img', () => ({
  pdf,
}))

describe('ocrService', () => {
  beforeEach(() => {
    recognize.mockReset()
    pdf.mockReset()
    destroy.mockReset()

    recognize.mockResolvedValue({ data: { text: 'invoice INV-1001 qty 500 total 5000' } })
    destroy.mockResolvedValue(undefined)
  })

  it('extracts text from supported image buffers with Tesseract', async () => {
    const { extractText } = await import('./ocrService.js')
    const imageBuffer = Buffer.from('fake-png')

    await expect(extractText(imageBuffer, 'image/png')).resolves.toBe(
      'invoice INV-1001 qty 500 total 5000',
    )
    expect(recognize).toHaveBeenCalledWith(imageBuffer, 'eng')
    expect(pdf).not.toHaveBeenCalled()
  })

  it('renders PDF pages to images before extracting OCR text', async () => {
    const firstPage = Buffer.from('page-one-image')
    const secondPage = Buffer.from('page-two-image')
    const document = {
      destroy,
      async *[Symbol.asyncIterator]() {
        yield firstPage
        yield secondPage
      },
    }

    pdf.mockResolvedValue(document)
    recognize
      .mockResolvedValueOnce({ data: { text: 'invoice INV-1001 qty 500' } })
      .mockResolvedValueOnce({ data: { text: 'total 5000' } })

    const { extractText } = await import('./ocrService.js')
    const pdfBuffer = Buffer.from('%PDF')

    await expect(extractText(pdfBuffer, 'application/pdf')).resolves.toBe(
      'invoice INV-1001 qty 500\n\ntotal 5000',
    )
    expect(pdf).toHaveBeenCalledWith(pdfBuffer, { scale: 3, format: 'png' })
    expect(recognize).toHaveBeenNthCalledWith(1, firstPage, 'eng')
    expect(recognize).toHaveBeenNthCalledWith(2, secondPage, 'eng')
    expect(destroy).toHaveBeenCalled()
  })

  it('falls back to embedded text for malformed vector PDFs', async () => {
    pdf.mockRejectedValue(new Error('Invalid PDF structure.'))

    const { extractText } = await import('./ocrService.js')
    const malformedPdfBuffer = Buffer.from(`
      %PDF-1.4
      BT
      (Invoice Number: INV-MED104-001) Tj
      (Quantity: 1200) Tj
      (Total: 12390.00) Tj
      ET
      %%EOF
    `)

    await expect(extractText(malformedPdfBuffer, 'application/pdf')).resolves.toBe(
      'Invoice Number: INV-MED104-001\nQuantity: 1200\nTotal: 12390.00',
    )
    expect(recognize).not.toHaveBeenCalled()
  })

  it('rejects unsupported file types', async () => {
    const { extractText } = await import('./ocrService.js')

    await expect(extractText(Buffer.from('not-an-image'), 'text/plain')).rejects.toMatchObject({
      statusCode: 415,
    })
  })
})
