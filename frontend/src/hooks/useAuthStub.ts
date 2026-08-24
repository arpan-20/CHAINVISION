import { useEffect, useState } from 'react'

/**
 * ⚠️ TEMPORARY STUB — replaced in Phase 23 by a real hook backed by a
 * Supabase Auth session (see 00_PROJECT_CONTEXT.md Section 5.5).
 *
 * Every other component must depend on this hook's RETURN SHAPE
 * ({ user, role, loading }) and never on the fact that it currently
 * fakes a session — that's what makes the Phase 23 swap a one-file
 * change (only this file gets rewritten; call sites don't move).
 */

export type PlannerRole = 'planner' | 'planning_manager'

export interface AuthStubUser {
  id: string
  name: string
  email: string
  initials: string
  dc: string
}

export interface UseAuthStubResult {
  user: AuthStubUser | null
  role: PlannerRole | null
  loading: boolean
}

const STUB_USER: AuthStubUser = {
  id: 'stub-planner-001',
  name: 'Ananya Rao',
  email: 'ananya.rao@medcarepharma.demo',
  initials: 'AR',
  dc: 'Kolkata DC',
}

const STUB_ROLE: PlannerRole = 'planner'

// Small artificial delay so consumers exercise their real loading state
// instead of always rendering the resolved user on first paint.
const STUB_SESSION_DELAY_MS = 250

export function useAuthStub(): UseAuthStubResult {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), STUB_SESSION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [])

  return {
    user: loading ? null : STUB_USER,
    role: loading ? null : STUB_ROLE,
    loading,
  }
}
