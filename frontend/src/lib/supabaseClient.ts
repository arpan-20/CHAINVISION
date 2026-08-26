import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseRealtimeConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseRealtimeConfigured) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set; realtime subscriptions are disabled.',
  )
}

export const supabaseClient = isSupabaseRealtimeConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null
