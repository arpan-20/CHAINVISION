import axios from 'axios'
import { attachApiInterceptor } from './apiInterceptor'

import { getSupabaseAccessToken } from '../lib/supabaseClient'

const baseURL = import.meta.env.VITE_P1_API_BASE

if (!baseURL) {
  // Fail loudly in dev — a silently-relative baseURL is a confusing bug
  // to chase later.
  console.warn('[p1Client] VITE_P1_API_BASE is not set — check your .env')
}

/**
 * Shared axios instance for the P1 backend. Planner components should
 * import this instead of calling axios directly, so auth headers,
 * base URL, and error logging stay in one place.
 */
export const p1Client = axios.create({
  baseURL,
  // Free-tier Render services can take longer than 10 seconds to wake after
  // idling. Keep the initial dashboard request alive instead of marking the
  // overview offline while P1 is starting.
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

p1Client.interceptors.request.use(async (config) => {
  const accessToken = await getSupabaseAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

p1Client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[p1Client] request failed:', error?.response?.status, error?.message)
    return Promise.reject(error)
  },
)

// --- Toast-on-error (Phase 24.3) ---
attachApiInterceptor(p1Client)
// --- end toast-on-error ---

export default p1Client
