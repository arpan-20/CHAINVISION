import { recognize } from 'tesseract.js'

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp',
  'image/tiff',
])

export class OcrUnsupportedMediaTypeError extends Error {
  statusCode = 415
  code = 'UNSUPPORTED_MEDIA_TYPE'
}

export class OcrProcessingError extends Error {
  statusCode = 502
  code = 'OCR_FAILED'

  constructor(message = 'OCR extraction failed; upload a clearer PDF or image and try again.') {
    super(message)
    this.name = 'OcrProcessingError'
  }
}

const extractTextFromImage = async (fileBuffer: Buffer): Promise<string> => {
  try {
    const result = await recognize(fileBuffer, 'eng')
    return result.data.text
  } catch (error) {
    throw new OcrProcessingError(
      `OCR extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

const decodePdfTextLiteral = (value: string): string =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')

const extractEmbeddedPdfText = (fileBuffer: Buffer): string => {
  const pdfText = fileBuffer.toString('latin1')
  const literalTextMatches = [...pdfText.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)]

  return literalTextMatches
    .map((match) => decodePdfTextLiteral(match[1] ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

const extractTextFromPdf = async (fileBuffer: Buffer): Promise<string> => {
  const { pdf } = await import('pdf-to-img')
  let document: AsyncIterable<Buffer> & { destroy?: () => Promise<void> | void }

  try {
    document = (await pdf(fileBuffer, { scale: 3, format: 'png' } as Parameters<typeof pdf>[1])) as AsyncIterable<Buffer> & {
      destroy?: () => Promise<void> | void
    }
  } catch (error) {
    const embeddedText = extractEmbeddedPdfText(fileBuffer)
    if (embeddedText) {
      return embeddedText
    }

    throw new OcrProcessingError(
      `PDF rendering failed before OCR: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  try {
    const pageTexts: string[] = []
    for await (const pageImage of document) {
      pageTexts.push(await extractTextFromImage(pageImage))
    }

    return pageTexts.join('\n\n').trim()
  } finally {
    await document.destroy?.()
  }
}

export const extractText = async (fileBuffer: Buffer, mimeType: string): Promise<string> => {
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    if (mimeType === 'application/pdf') {
      return extractTextFromPdf(fileBuffer)
    }

    throw new OcrUnsupportedMediaTypeError(`Unsupported OCR file type: ${mimeType}`)
  }

  return extractTextFromImage(fileBuffer)
}
