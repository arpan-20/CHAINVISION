import { useCallback, useEffect, useState } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'

import { supabaseClient } from '../lib/supabaseClient'

export type AuthRole = 'PLANNER' | 'PROCUREMENT_OFFICER' | 'ADMIN'

export interface AuthUser {
  id: string
  name: string
  email: string
  initials: string
  dc: string
}

export interface UseAuthResult {
  user: AuthUser | null
  role: AuthRole | null
  loading: boolean
  signOut: () => Promise<void>
}

interface UserProfileRow {
  email: string
  role: AuthRole
}

const displayNameFromEmail = (email: string) =>
  email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || email

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CV'

const dcForRole = (role: AuthRole | null) =>
  role === 'PROCUREMENT_OFFICER' ? 'Procurement Ops' : role === 'ADMIN' ? 'All DCs' : 'Kolkata DC'

const toAuthUser = (authUser: SupabaseUser, profile: UserProfileRow | null): AuthUser => {
  const email = profile?.email ?? authUser.email ?? ''
  const metadata = authUser.user_metadata ?? {}
  const name =
    typeof metadata.name === 'string'
      ? metadata.name
      : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : displayNameFromEmail(email)

  return {
    id: authUser.id,
    name,
    email,
    initials: initialsFromName(name),
    dc: typeof metadata.dc === 'string' ? metadata.dc : dcForRole(profile?.role ?? null),
  }
}

async function loadSessionUser(session: Session | null) {
  if (!supabaseClient || !session?.user) {
    return { user: null, role: null }
  }

  const { data, error } = await supabaseClient
    .from('users')
    .select('email, role')
    .eq('id', session.user.id)
    .maybeSingle<UserProfileRow>()

  if (error) {
    throw error
  }

  return {
    user: toAuthUser(session.user, data ?? null),
    role: data?.role ?? null,
  }
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [role, setRole] = useState<AuthRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const applySession = async (session: Session | null) => {
      try {
        const next = await loadSessionUser(session)
        if (cancelled) return
        setUser(next.user)
        setRole(next.role)
      } catch (error) {
        console.error('[useAuth] failed to load profile:', error)
        if (cancelled) return
        setUser(null)
        setRole(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!supabaseClient) {
      setUser(null)
      setRole(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    supabaseClient.auth.getSession().then(({ data }) => applySession(data.session))

    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setLoading(true)
      void applySession(session)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabaseClient) return
    try {
      await supabaseClient.auth.signOut()
    } catch (error) {
      // Logout should always finish locally, even if the remote session
      // endpoint is unavailable. Avoid leaving the protected dashboard mounted
      // long enough for its in-flight API calls to show error toasts.
      console.warn('[useAuth] remote sign-out failed; clearing local session', error)
    } finally {
      window.location.replace('/login')
    }
  }, [])

  return { user, role, loading, signOut }
}
