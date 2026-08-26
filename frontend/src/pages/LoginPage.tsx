import { FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { supabaseClient } from '../lib/supabaseClient'
import { useAuth, type AuthRole } from '../hooks/useAuth'
import { NetworkMark } from '../components/icons'

interface LocationState {
  from?: {
    pathname?: string
  }
}

const homeForRole = (role: AuthRole | null) => {
  if (role === 'PROCUREMENT_OFFICER') return '/procurement'
  return '/planner'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locationState = location.state as LocationState | null
  const configured = Boolean(supabaseClient)

  if (!loading && user) {
    return <Navigate to={homeForRole(role)} replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabaseClient) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    const { data: profile } = data.user
      ? await supabaseClient.from('users').select('role').eq('id', data.user.id).maybeSingle<{ role: AuthRole }>()
      : { data: null }

    navigate(locationState?.from?.pathname ?? homeForRole(profile?.role ?? null), { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-10 text-paper">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-signal">
            <NetworkMark className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse-dot rounded-full bg-signal" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">CHAINVISION</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Secure dashboard</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-line bg-panel p-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>

          <label className="mt-5 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-1.5 w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm text-paper outline-none transition-colors focus:border-signal/50"
            />
          </label>

          <label className="mt-4 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm text-paper outline-none transition-colors focus:border-signal/50"
            />
          </label>

          {!configured && (
            <p className="mt-4 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
              Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !configured}
            className="mt-5 w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
