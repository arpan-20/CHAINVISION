import axios from 'axios'

import { supabaseClient } from '../lib/supabaseClient'

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
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

p1Client.interceptors.request.use(async (config) => {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
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

export default p1Client
