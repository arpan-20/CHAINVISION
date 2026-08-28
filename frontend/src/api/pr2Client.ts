import axios from 'axios'
import { attachApiInterceptor } from './apiInterceptor' 

import { getSupabaseAccessToken } from '../lib/supabaseClient'

const baseURL = import.meta.env.VITE_PR2_API_BASE

if (!baseURL) {
  // Fail loudly in dev — a silently-relative baseURL is a confusing bug
  // to chase later.
  console.warn('[pr2Client] VITE_PR2_API_BASE is not set — check your .env')
}

/**
 * Shared axios instance for the PR2 backend (Java/Spring Boot, Procure-to-Pay).
 * Procurement components should import this instead of calling axios
 * directly, so auth headers, base URL, and error logging stay in one place.
 */
export const pr2Client = axios.create({
  baseURL,
  // Exception queue responses include the latest match and AI explanation
  // for every pending invoice and can take longer than the lightweight PR2
  // overview endpoints. Keep the request alive long enough for Spring to
  // finish querying and serializing the queue instead of aborting it at 10s.
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

pr2Client.interceptors.request.use(async (config) => {
  const accessToken = await getSupabaseAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

pr2Client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[pr2Client] request failed:', error?.response?.status, error?.message)
    return Promise.reject(error)
  },
)

// --- Toast-on-error (Phase 24.3) ---
attachApiInterceptor(pr2Client) 
// --- end toast-on-error ---

export default pr2Client
