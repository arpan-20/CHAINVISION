import { NavLink } from 'react-router-dom'

import { useAuthStub } from '../hooks/useAuthStub'
import {
  CrateIcon,
  HourglassIcon,
  NetworkMark,
  OverviewIcon,
  PulseIcon,
  RouteIcon,
} from './icons'

const NAV_ITEMS = [
  { to: '/planner', label: 'Overview', icon: OverviewIcon, end: true },
  { to: '/planner/inventory', label: 'Inventory', icon: CrateIcon, end: false },
  { to: '/planner/expiry-risk', label: 'Expiry Risk', icon: HourglassIcon, end: false },
  { to: '/planner/replenishment', label: 'Replenishment', icon: RouteIcon, end: false },
  { to: '/planner/demand-signals', label: 'Demand Signals', icon: PulseIcon, end: false },
] as const

export default function NavBar() {
  const { user, role, loading } = useAuthStub()

  return (
    <aside className="flex h-screen w-[76px] shrink-0 flex-col border-r border-line bg-panel md:w-64">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-5 md:px-6">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 text-signal">
          <NetworkMark className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse-dot rounded-full bg-signal" />
        </div>
        <div className="hidden md:block">
          <p className="font-display text-sm font-semibold tracking-tight text-paper">CHAINVISION</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Planner</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 md:px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-panel2 text-paper'
                  : 'text-mist hover:bg-panel2/60 hover:text-paper',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-signal transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  ].join(' ')}
                />
                <Icon
                  className={[
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive ? 'text-signal' : 'text-mist group-hover:text-signal',
                  ].join(' ')}
                />
                <span className="hidden truncate md:inline">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Auth-stub user card */}
      <div className="border-t border-line p-3 md:p-4">
        <div className="flex items-center gap-3 rounded-lg bg-panel2 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-signal">
            {loading ? '···' : user?.initials}
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-xs font-medium text-paper">
              {loading ? 'Loading session…' : user?.name}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-mist">
              {loading ? '—' : role}
            </p>
          </div>
        </div>
        <p className="mt-2 hidden font-mono text-[9px] uppercase tracking-[0.2em] text-alert/80 md:block">
          Demo session
        </p>
      </div>
    </aside>
  )
}
