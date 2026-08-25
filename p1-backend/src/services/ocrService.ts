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

export const extractText = async (fileBuffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    // Phase 15 known limitation: Tesseract.js needs image input. PDF invoices require a
    // PDF-to-image pre-conversion step before OCR; Phase 16/24 can add pdf-to-img or a
    // similar converter, or fall back to Gemini document extraction.
    throw new OcrUnsupportedMediaTypeError(
      'PDF OCR requires a PDF-to-image conversion step before Tesseract.js can extract text',
    )
  }

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new OcrUnsupportedMediaTypeError(`Unsupported OCR file type: ${mimeType}`)
  }

  const result = await recognize(fileBuffer, 'eng')
  return result.data.text
}
