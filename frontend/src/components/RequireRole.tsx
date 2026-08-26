import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

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

    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
        <div className="max-w-md rounded-xl border border-line bg-panel p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-critical">Access denied</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Wrong dashboard for this role</h1>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            You are signed in as {user.email}, but this route is limited to a different CHAINVISION role.
          </p>
          <Link
            to={home}
            className="mt-5 inline-flex rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Go to your dashboard
          </Link>
        </div>
      </main>
    )
  }

  return children
}
