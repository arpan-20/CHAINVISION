import { Router } from 'express'
import multer from 'multer'

import { env } from '../config/env'
import { extractText } from '../services/ocrService'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

export const internalOcrRoutes = Router()

internalOcrRoutes.post('/internal/ocr/extract', upload.single('file'), async (req, res, next) => {
  try {
    const internalKey = req.header('x-internal-key')
    if (!internalKey || internalKey !== env.internalApiKey) {
      res.status(401).json({ error: 'Invalid internal API key' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'file is required' })
      return
    }

    const rawText = await extractText(req.file.buffer, req.file.mimetype)
    res.status(200).json({ rawText })
  } catch (error) {
    next(error)
  }
})
