import 'dotenv/config'

export interface AppEnv {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  p1Port: number
  pr2BaseUrl: string
  internalApiKey: string
}

const required = (name: string): string => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`)
  }

  return value
}

const parsePort = (value: string): number => {
  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[config] P1_PORT must be an integer between 1 and 65535`)
  }

  return port
}

export const env: AppEnv = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  p1Port: parsePort(required('P1_PORT')),
  pr2BaseUrl: required('PR2_BASE_URL'),
  internalApiKey: required('INTERNAL_API_KEY'),
}
