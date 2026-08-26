import axios, { type AxiosError } from 'axios'
import { env } from '../config/env'
import type { ReplenishmentRecommendationContract } from './recommendationService'

const PR2_BASE_URL = process.env.PR2_BASE_URL ?? 'http://pr2-backend:8080'
const HANDOFF_ENDPOINT = `${PR2_BASE_URL}/api/requisitions/from-recommendation`
const RETRY_DELAY_MS = 750
const REQUEST_TIMEOUT_MS = 5000

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const postRecommendation = async (
  recommendation: ReplenishmentRecommendationContract,
): Promise<void> => {
  await axios.post(HANDOFF_ENDPOINT, recommendation, {
    headers: {
      'Content-Type': 'application/json',
      // PR2 accepts this service-to-service handoff via the shared internal key.
      'x-internal-key': env.internalApiKey,
    },
    timeout: REQUEST_TIMEOUT_MS,
  })
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
    const message = (firstError as AxiosError).message ?? String(firstError)
    console.error(
      `[pr2ClientService] Handoff POST failed for recommendationId=` +
        `${recommendation.recommendationId} to ${HANDOFF_ENDPOINT}: ${message}. Retrying once...`,
    )
  }

  await delay(RETRY_DELAY_MS)

  try {
    await postRecommendation(recommendation)
    return
  } catch (secondError) {
    const message = (secondError as AxiosError).message ?? String(secondError)
    console.error(
      `[pr2ClientService] Retry also failed for recommendationId=` +
        `${recommendation.recommendationId} to ${HANDOFF_ENDPOINT}: ${message}. ` +
        `Giving up — recommendation remains in status NEW and was not sent to procurement.`,
    )
    throw secondError
  }
}
