import axios, { type AxiosError } from 'axios'
import { env } from '../config/env'
import type { ReplenishmentRecommendationContract } from './recommendationService'

// Use the validated, dotenv-loaded configuration rather than reading
// process.env directly during module initialization.  The latter can be
// unset when this module is evaluated before the dotenv config module, which
// silently routes handoffs to the wrong host (or sends an empty key).
const HANDOFF_ENDPOINTS = [
  `${env.pr2BaseUrl.replace(/\/$/, '')}/api/requisitions/from-recommendation`,
  // When P1 is run locally but inherits the Docker service hostname, the
  // configured host is unreachable while the published PR2 port is live.
  ...(env.pr2BaseUrl.includes('pr2-backend')
    ? ['http://localhost:8080/api/requisitions/from-recommendation']
    : []),
]
const RETRY_DELAY_MS = 750
const REQUEST_TIMEOUT_MS = 5000

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const postRecommendation = async (
  recommendation: ReplenishmentRecommendationContract,
): Promise<void> => {
  let lastError: unknown
  for (const endpoint of HANDOFF_ENDPOINTS) {
    try {
      await axios.post(endpoint, recommendation, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': env.internalApiKey,
        },
        timeout: REQUEST_TIMEOUT_MS,
      })
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

/**
 * Sends a replenishment recommendation to PR2 to seed a system-generated
 * purchase requisition. Retries exactly once on failure (network error or
 * non-2xx), then logs and rethrows so the caller can decide what to do
 * (recommendationService catches this and leaves status as NEW).
 */
export const sendRecommendation = async (
  recommendation: ReplenishmentRecommendationContract,
): Promise<void> => {
  try {
    await postRecommendation(recommendation)
    return
  } catch (firstError) {
    const axiosError = firstError as AxiosError
    const message = axiosError.message ?? String(firstError)
    const detail = axiosError.response?.data ? ` response=${JSON.stringify(axiosError.response.data)}` : ''
    console.error(
      `[pr2ClientService] Handoff POST failed for recommendationId=` +
        `${recommendation.recommendationId} to ${HANDOFF_ENDPOINTS.join(', ')}: ${message}.${detail} Retrying once...`,
    )
  }

  await delay(RETRY_DELAY_MS)

  try {
    await postRecommendation(recommendation)
    return
  } catch (secondError) {
    const axiosError = secondError as AxiosError
    const message = axiosError.message ?? String(secondError)
    const detail = axiosError.response?.data ? ` response=${JSON.stringify(axiosError.response.data)}` : ''
    console.error(
      `[pr2ClientService] Retry also failed for recommendationId=` +
        `${recommendation.recommendationId} to ${HANDOFF_ENDPOINTS.join(', ')}: ${message}.${detail} ` +
        `Giving up — recommendation remains in status NEW and was not sent to procurement.`,
    )
    throw secondError
  }
}
