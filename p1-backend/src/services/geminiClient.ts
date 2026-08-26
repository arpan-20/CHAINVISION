import { UpstreamServiceError, withRetry } from '../middleware/rateLimitAwareRetry'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim()
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponsePart {
  text?: string
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[]
    }
  }>
}

const stripMarkdownFences = (text: string): string => {
  let trimmed = text.trim()

  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```[a-zA-Z]*\n/, '')
    trimmed = trimmed.replace(/```\s*$/, '')
  }

  return trimmed.trim()
}

export const isGeminiConfigured = (): boolean => Boolean(GEMINI_API_KEY)

export const generateText = async (prompt: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const response = await withRetry(
    async () => {
      const result = await fetch(
        `${GEMINI_BASE_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(
          GEMINI_API_KEY,
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 160,
            },
          }),
        },
      )

      if (!result.ok) {
        const detail = await result.text().catch(() => '')
        throw new UpstreamServiceError(
          `Gemini call failed with ${result.status}: ${detail}`,
          result.status,
        )
      }

      return result
    },
    { maxRetries: 2, baseDelayMs: 500, label: 'Gemini generateContent' },
  )

  const body = (await response.json()) as GeminiResponse
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini response had no text candidate')
  }

  return stripMarkdownFences(text)
}
