import axios from 'axios'

import { supabaseClient } from '../lib/supabaseClient'

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
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

pr2Client.interceptors.request.use(async (config) => {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
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

export default pr2Client