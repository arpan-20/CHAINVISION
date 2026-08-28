import { useEffect, useState } from 'react'

/* ──────────────────────────────────────────────
   LIVE ACTIVITY FEED — recent platform events ticker
   ────────────────────────────────────────────── */
export interface ActivityEvent {
  id: string
  type: 'po' | 'pr' | 'invoice' | 'inventory' | 'exception' | 'replenishment'
  message: string
  detail?: string
  tone: 'signal' | 'warning' | 'critical' | 'mist'
  timestamp: string // ISO
}

const SAMPLE_ACTIVITY: ActivityEvent[] = [
  { id: '1', type: 'po', message: 'PO-2847 acknowledged by Supplier A', detail: 'ETA confirmed 2026-08-31', tone: 'signal', timestamp: '2026-08-28T11:42:00Z' },
  { id: '2', type: 'exception', message: 'Invoice INV-1932 needs review', detail: 'Quantity mismatch on PO-2839', tone: 'critical', timestamp: '2026-08-28T11:38:00Z' },
  { id: '3', type: 'replenishment', message: 'New replenishment plan for DC-04', detail: '7 SKUs below reorder point', tone: 'warning', timestamp: '2026-08-28T11:24:00Z' },
  { id: '4', type: 'invoice', message: 'Auto-approved 12 invoices', detail: 'Touchless rate 91%', tone: 'signal', timestamp: '2026-08-28T11:11:00Z' },
  { id: '5', type: 'inventory', message: 'Batch B-2847-3 expiring in 4 days', detail: 'DC-02 (Mumbai)', tone: 'warning', timestamp: '2026-08-28T10:58:00Z' },
  { id: '6', type: 'pr', message: 'PR-1923 sourced to Supplier C', detail: '3 quotes analyzed', tone: 'signal', timestamp: '2026-08-28T10:42:00Z' },
]

const toneColor: Record<ActivityEvent['tone'], string> = {
  signal: 'bg-signal',
  warning: 'bg-alert',
  critical: 'bg-critical',
  mist: 'bg-mist/60',
}

const typeIcon: Record<ActivityEvent['type'], JSX.Element> = {
  po: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  pr: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  invoice: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  inventory: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  exception: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  replenishment: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
}

function timeAgo(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function LiveActivityFeed({ events = SAMPLE_ACTIVITY, className = '' }: { events?: ActivityEvent[]; className?: string }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className={`overflow-hidden rounded-lg border border-white/10 bg-panel/70 backdrop-blur-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal shadow-[0_0_6px_rgba(47,227,196,0.7)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Live activity</p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist/50">
          {events.length} events
        </span>
      </div>

      {/* Events list */}
      <ul className="divide-y divide-white/5">
        {events.map((event) => (
          <li
            key={event.id}
            className="group flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
          >
            {/* Type icon */}
            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${toneColor[event.tone].replace('bg-', 'border-').replace('/60', '/30').replace('/70', '/40')} ${toneColor[event.tone].replace('bg-', 'bg-').replace('/60', '/10').replace('/70', '/10')} ${toneColor[event.tone].replace('bg-', 'text-')}`}>
              {typeIcon[event.type]}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-paper">{event.message}</p>
              {event.detail && (
                <p className="truncate text-[10px] text-mist/70">{event.detail}</p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-mist/60" suppressHydrationWarning>
                {timeAgo(event.timestamp)}
              </span>
              <span className={`h-1 w-1 rounded-full ${toneColor[event.tone]}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
