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
}

const extractTextFromImage = async (fileBuffer: Buffer): Promise<string> => {
  const result = await recognize(fileBuffer, 'eng')
  return result.data.text
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
  let document

  try {
    document = await pdf(fileBuffer, { scale: 3, format: 'png' })
  } catch (error) {
    const embeddedText = extractEmbeddedPdfText(fileBuffer)
    if (embeddedText) {
      return embeddedText
    }

    throw error
  }

  try {
    const pageTexts: string[] = []
    for await (const pageImage of document) {
      pageTexts.push(await extractTextFromImage(pageImage))
    }

    return pageTexts.join('\n\n').trim()
  } finally {
    await document.destroy()
  }
}

export const extractText = async (fileBuffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    return extractTextFromPdf(fileBuffer)
  }

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new OcrUnsupportedMediaTypeError(`Unsupported OCR file type: ${mimeType}`)
  }

  return extractTextFromImage(fileBuffer)
}
