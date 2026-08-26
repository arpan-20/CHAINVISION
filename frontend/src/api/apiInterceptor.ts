import type { AxiosInstance, AxiosError } from 'axios'
import { pushToast } from '../hooks/useToast'

interface ApiErrorShape {
  error: {
    code: string
    message: string
  }
}

const isApiErrorShape = (data: unknown): data is ApiErrorShape => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as { error?: unknown }).error === 'object' &&
    (data as ApiErrorShape).error !== null &&
    typeof (data as ApiErrorShape).error.message === 'string'
  )
}

/**
 * Registers a response interceptor that automatically toasts any error
 * response matching the { error: { code, message } } shape from
 * P24.1/P24.2. Individual page components don't need manual try/catch
 * toast calls for this common case.
 */
export const attachApiInterceptor = (client: AxiosInstance): void => {
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const data = error.response?.data

      if (isApiErrorShape(data)) {
        pushToast('error', data.error.message)
      } else if (error.code === 'ECONNABORTED' || !error.response) {
        // Network error / timeout / backend unreachable — no structured
        // error body to read, but still worth surfacing.
        pushToast('error', 'Could not reach the server. Please try again.')
      } else {
        pushToast('error', 'Something went wrong. Please try again.')
      }

      return Promise.reject(error)
    },
  )
}