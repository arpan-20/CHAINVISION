import type { ComponentType } from 'react'
import { useMemo, useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { NetworkMark, OverviewIcon } from '../../components/icons'
import { useAuthStub } from '../../hooks/useAuthStub'

// ---------------------------------------------------------------------------
// Icons
//
// The shared `NavBar`/`icons.tsx` set is Planner-specific (hardcoded nav
// items) and is read-only for this phase — see 00_PROJECT_CONTEXT.md /
// P19.1 constraints. Procurement gets its own small icon set here, kept in
// the same "minimal line icon" style as `components/icons.tsx` so the two
// dashboards feel like one product. `OverviewIcon` and `NetworkMark` are
// reused as-is since they're generic, not Planner-specific.
// ---------------------------------------------------------------------------

type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function RequisitionIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 3.5h8l3 3v14h-11Z" />
      <path d="M14.5 3.5v3h3" />
      <path d="M9 12h6M9 15.5h6M9 8.5h3" />
    </svg>
  )
}

function PurchaseOrderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="5.5" width="16" height="15" rx="1.4" />
      <path d="M8.5 3.5v4M15.5 3.5v4" />
      <path d="M7.5 11h9M7.5 14.5h9M7.5 18h5.5" />
    </svg>
  )
}

function GoodsReceiptIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 8.2 12 4l8.5 4.2v7.6L12 20l-8.5-4.2Z" />
      <path d="M3.5 8.2 12 12l8.5-4.2" />
      <path d="M12 12v8" />
      <path d="m9 12.5 2 2 3.5-4" />
    </svg>
  )
}

function InvoiceIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h12v17l-2.5-1.5L13 20.5 10.5 19 8 20.5 5.5 19V5Z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </svg>
  )
}

function ExceptionIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 21 19.5H3Z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function AnalyticsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </svg>
  )
}

export const ProcurementIcons = {
  RequisitionIcon,
  PurchaseOrderIcon,
  GoodsReceiptIcon,
  InvoiceIcon,
  ExceptionIcon,
  AnalyticsIcon,
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

export const PROCUREMENT_NAV_ITEMS = [
  { to: '/procurement', label: 'Overview', icon: OverviewIcon, end: true },
  { to: '/procurement/requisitions', label: 'Requisitions', icon: RequisitionIcon, end: false },
  { to: '/procurement/purchase-orders', label: 'Purchase Orders', icon: PurchaseOrderIcon, end: false },
  { to: '/procurement/goods-receipt', label: 'Goods Receipt', icon: GoodsReceiptIcon, end: false },
  { to: '/procurement/invoices', label: 'Invoices', icon: InvoiceIcon, end: false },
  { to: '/procurement/exceptions', label: 'Exceptions', icon: ExceptionIcon, end: false },
  { to: '/procurement/analytics', label: 'Analytics', icon: AnalyticsIcon, end: false },
] as const

const PAGE_TITLES: Record<string, string> = {
  '/procurement': 'Overview',
  '/procurement/requisitions': 'Requisitions',
  '/procurement/purchase-orders': 'Purchase Orders',
  '/procurement/goods-receipt': 'Goods Receipt',
  '/procurement/invoices': 'Invoices',
  '/procurement/exceptions': 'Exceptions',
  '/procurement/analytics': 'Analytics',
}

function ProcurementNavBar() {
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
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Procurement</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 md:px-3">
        {PROCUREMENT_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-panel2 text-paper' : 'text-mist hover:bg-panel2/60 hover:text-paper',
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
            <p className="truncate text-xs font-medium text-paper">{loading ? 'Loading session…' : user?.name}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-mist">
              {loading ? '—' : role}
            </p>
          </div>
        </div>
        <p className="mt-2 hidden font-mono text-[9px] uppercase tracking-[0.2em] text-alert/80 md:block">
          Stub session · Phase 23 swaps this
        </p>
      </div>
    </aside>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function TopBar() {
  const location = useLocation()
  const { user } = useAuthStub()
  const now = useClock()

  const title = PAGE_TITLES[location.pathname] ?? 'Procurement'
  const time = useMemo(
    () => now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [now],
  )

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-ink px-5 py-3.5 md:px-8">
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
          MedCare Pharma / Procurement
        </p>
        <h1 className="truncate font-display text-lg font-semibold tracking-tight text-paper">{title}</h1>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {user && <span className="hidden font-mono text-xs text-mist lg:inline">{user.dc}</span>}
        <span className="flex items-center gap-1.5 font-mono text-xs text-mist">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" />
          {time}
        </span>
      </div>
    </header>
  )
}

/**
 * Placeholder content for the Requisitions / Purchase Orders / Goods
 * Receipt / Invoices / Exceptions / Analytics routes — real views land in
 * P19.2 / P19.3. Exported so `App.tsx` can wire routes for every nav item
 * without those views existing yet (keeps the nav fully clickable now).
 */
export function ProcurementSectionPlaceholder({
  icon: Icon,
  title,
  description,
  comingIn,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  comingIn: string[]
}) {
  return (
    <div className="animate-rise-in mx-auto flex max-w-2xl flex-col items-start gap-5 rounded-2xl border border-line bg-panel px-8 py-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-panel2 text-signal">
        <Icon className="h-6 w-6" />
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Module preview</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-paper">{title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-mist">{description}</p>
      </div>

      <div className="w-full rounded-xl border border-line bg-ink/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Lands in P19.2 / P19.3</p>
        <ul className="mt-2 space-y-1.5">
          {comingIn.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-paper/80">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ProcurementLayout() {
  return (
    <div className="flex h-screen bg-ink text-paper">
      <ProcurementNavBar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="bg-grid flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}