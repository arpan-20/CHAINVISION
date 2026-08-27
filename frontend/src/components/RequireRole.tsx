import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth, type AuthRole } from '../hooks/useAuth'

interface RequireRoleProps {
  role?: AuthRole
  roles?: AuthRole[]
  children: ReactNode
}

const dashboardForRole = (role: AuthRole | null) => {
  if (role === 'PROCUREMENT_OFFICER') return '/procurement'
  return '/planner'
}

export default function RequireRole({ role, roles, children }: RequireRoleProps) {
  const location = useLocation()
  const { user, role: userRole, loading } = useAuth()
  const allowedRoles = roles ?? (role ? [role] : [])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
        <div className="rounded-xl border border-line bg-panel px-6 py-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Checking session</p>
          <p className="mt-2 font-display text-xl font-semibold">Loading...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles.length > 0 && (!userRole || !allowedRoles.includes(userRole))) {
    const home = dashboardForRole(userRole)
    return <Navigate to={home} replace />
  }

  return children
}
