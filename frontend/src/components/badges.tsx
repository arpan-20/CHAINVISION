import type { ReactNode } from 'react'

export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ExpiryRisk = 'OK' | 'WARNING' | 'CRITICAL' | 'EXPIRED'

const URGENCY_STYLES: Record<Urgency, string> = {
  LOW: 'text-mist border-line bg-panel2',
  MEDIUM: 'text-signal border-signal/30 bg-signal/10',
  HIGH: 'text-alert border-alert/30 bg-alert/10',
  CRITICAL: 'text-critical border-critical/40 bg-critical/10',
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${URGENCY_STYLES[urgency]}`}
    >
      {urgency}
    </span>
  )
}

const RISK_STYLES: Record<ExpiryRisk, string> = {
  OK: 'text-signal border-signal/30 bg-signal/10',
  WARNING: 'text-alert border-alert/30 bg-alert/10',
  CRITICAL: 'text-critical border-critical/40 bg-critical/10',
  EXPIRED: 'text-paper border-critical bg-critical/60',
}

export function RiskBadge({ risk }: { risk: ExpiryRisk }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${RISK_STYLES[risk]}`}
    >
      {risk}
    </span>
  )
}

export const RISK_CELL_STYLES: Record<ExpiryRisk | 'EMPTY', string> = {
  OK: 'bg-signal/20 border-signal/40 text-signal',
  WARNING: 'bg-alert/25 border-alert/50 text-alert',
  CRITICAL: 'bg-critical/30 border-critical/60 text-critical',
  EXPIRED: 'bg-critical/70 border-critical text-paper',
  EMPTY: 'bg-panel border-line text-mist/40',
}

export function RefreshButton({
  onClick,
  loading,
  children = 'Refresh',
}: {
  onClick: () => void
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel2 px-3.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-signal/40 hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={loading ? 'animate-pulse-dot' : ''}>↻</span>
      {loading ? 'Refreshing…' : children}
    </button>
  )
}
