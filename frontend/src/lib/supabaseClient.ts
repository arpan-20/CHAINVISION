import { createClient, type Session } from '@supabase/supabase-js'

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

// Supabase restores the browser session asynchronously. Dashboard components
// mount immediately after navigation, so API calls must not race that restore
// and leave without their Bearer token on the first page load.
let resolveInitialSession: ((session: Session | null) => void) | undefined
const initialSession = new Promise<Session | null>((resolve) => {
  resolveInitialSession = resolve
})

if (supabaseClient) {
  const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' && resolveInitialSession) {
      resolveInitialSession(session)
      resolveInitialSession = undefined
    }
  })

  // This listener is application-wide and intentionally remains active for
  // the lifetime of the browser session.
  void data.subscription
} else {
  resolveInitialSession?.(null)
  resolveInitialSession = undefined
}

export async function getSupabaseAccessToken(): Promise<string | undefined> {
  if (!supabaseClient) return undefined

  const { data } = await supabaseClient.auth.getSession()
  if (data.session?.access_token) return data.session.access_token

  return (await initialSession)?.access_token
}
