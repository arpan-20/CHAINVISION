import { useEffect, useMemo, useState } from 'react'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton } from '../../components/badges'
import { formatINR } from '../../lib/format'

/* ──────────────────────────────────────────────
   SUPPLIER SCORECARD
   Reads GET /api/suppliers and computes a deterministic composite
   score (OTD × 0.4 + Quality × 0.4 + (100 - priceIndex) × 0.2) so the
   ranking is auditable. No backend changes — uses existing PR2 data.
   ────────────────────────────────────────────── */

interface Supplier {
  id: string
  name: string
  /** Relative cost score — 100 = baseline, higher = more expensive */
  priceIndex: number
  avgLeadTimeDays: number
  /** On-time delivery %, 0–100 */
  otdScore: number
  /** Quality score, 0–100 */
  qualityScore: number
  capacityUnits: number
}

type SortBy = 'composite' | 'otd' | 'quality' | 'price' | 'leadTime' | 'capacity'

type LoadState = 'loading' | 'ok' | 'error'

const SCORE_WEIGHTS = { otd: 0.4, quality: 0.4, price: 0.2 }

function compositeScore(s: Supplier): number {
  // priceIndex is "higher = more expensive", so invert it for "cheaper is better"
  const priceScore = Math.max(0, 100 - s.priceIndex)
  return (
    s.otdScore * SCORE_WEIGHTS.otd +
    s.qualityScore * SCORE_WEIGHTS.quality +
    priceScore * SCORE_WEIGHTS.price
  )
}

function tier(score: number): { label: string; tone: 'signal' | 'warning' | 'critical' } {
  if (score >= 90) return { label: 'STRATEGIC', tone: 'signal' }
  if (score >= 80) return { label: 'PREFERRED', tone: 'signal' }
  if (score >= 70) return { label: 'ACCEPTABLE', tone: 'warning' }
  return { label: 'AT RISK', tone: 'critical' }
}

export default function SupplierScorecardPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [sortBy, setSortBy] = useState<SortBy>('composite')

  const load = () => {
    setState('loading')
    pr2Client
      .get<Supplier[]>('/suppliers')
      .then((res) => {
        setSuppliers(Array.isArray(res.data) ? res.data : [])
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  const sorted = useMemo(() => {
    const arr = [...suppliers]
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'otd': return b.otdScore - a.otdScore
        case 'quality': return b.qualityScore - a.qualityScore
        case 'price': return a.priceIndex - b.priceIndex
        case 'leadTime': return a.avgLeadTimeDays - b.avgLeadTimeDays
        case 'capacity': return b.capacityUnits - a.capacityUnits
        case 'composite':
        default: return compositeScore(b) - compositeScore(a)
      }
    })
    return arr
  }, [suppliers, sortBy])

  // Headline KPIs
  const bestOtd = useMemo(() => suppliers.reduce((m, s) => Math.max(m, s.otdScore), 0), [suppliers])
  const avgLead = useMemo(() => suppliers.length
    ? suppliers.reduce((sum, s) => sum + s.avgLeadTimeDays, 0) / suppliers.length
    : 0, [suppliers])
  const totalCapacity = useMemo(() => suppliers.reduce((sum, s) => sum + s.capacityUnits, 0), [suppliers])
  const atRisk = useMemo(() => suppliers.filter((s) => tier(compositeScore(s)).tone === 'critical').length, [suppliers])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Supplier scorecard</h2>
          <p className="mt-1 text-sm text-mist">
            Composite ranking by OTD (40%), quality (40%), and price competitiveness (20%) — auditable deterministic scoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="field-control"
          >
            <option value="composite">Sort: composite</option>
            <option value="otd">Sort: OTD</option>
            <option value="quality">Sort: quality</option>
            <option value="price">Sort: price (low → high)</option>
            <option value="leadTime">Sort: lead time (fast → slow)</option>
            <option value="capacity">Sort: capacity</option>
          </select>
          <RefreshButton onClick={load} loading={state === 'loading'} />
        </div>
      </div>

      {/* Headline KPIs */}
      {state === 'ok' && suppliers.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <KpiMini label="Suppliers tracked" value={suppliers.length.toString()} />
          <KpiMini label="Best OTD" value={`${bestOtd.toFixed(0)}%`} tone="signal" />
          <KpiMini label="Avg lead time" value={`${avgLead.toFixed(1)}d`} />
          <KpiMini
            label="At-risk"
            value={atRisk.toString()}
            tone={atRisk > 0 ? 'critical' : 'signal'}
            hint={atRisk > 0 ? 'Tier below 70 — consider backup' : 'All in healthy tiers'}
          />
        </div>
      )}

      {/* Total capacity footer (lightweight insight) */}
      {state === 'ok' && suppliers.length > 0 && (
        <div className="rounded-xl border border-line bg-panel/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Total network capacity</p>
              <p className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-paper">
                {totalCapacity.toLocaleString('en-IN')} <span className="text-sm text-mist">units/mo</span>
              </p>
            </div>
            <p className="text-xs text-mist">
              Combined annual procurement throughput across {suppliers.length} active pharma suppliers
            </p>
          </div>
        </div>
      )}

      {/* Error / loading / empty */}
      {state === 'error' ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' ? (
        <div className="h-64 animate-pulse rounded-xl border border-line bg-panel" />
      ) : suppliers.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-mist">
          No suppliers loaded. Run the demo seed (0005 + 0006) and refresh.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((s) => {
            const composite = compositeScore(s)
            const t = tier(composite)
            const priceScore = Math.max(0, 100 - s.priceIndex)
            return (
              <article
                key={s.id}
                className={`relative overflow-hidden rounded-xl border bg-panel p-5 transition-all hover:border-signal/40 ${
                  t.tone === 'critical' ? 'border-critical/30' : t.tone === 'warning' ? 'border-alert/30' : 'border-line'
                }`}
              >
                {/* Rank badge */}
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                      t.tone === 'critical'
                        ? 'border-critical/40 text-critical bg-critical/10'
                        : t.tone === 'warning'
                        ? 'border-alert/30 text-alert bg-alert/10'
                        : 'border-signal/30 text-signal bg-signal/10'
                    }`}
                  >
                    {t.label}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-signal/30 bg-signal/10 font-display text-xs font-semibold text-signal">
                    {composite.toFixed(0)}
                  </span>
                </div>

                <h3 className="font-display text-lg font-semibold text-paper">{s.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-mist">Capacity {s.capacityUnits.toLocaleString('en-IN')} units</p>

                {/* Score bars */}
                <div className="mt-4 space-y-2">
                  <ScoreBar label="On-time delivery" value={s.otdScore} weight={0.4} color="signal" />
                  <ScoreBar label="Quality" value={s.qualityScore} weight={0.4} color="signal" />
                  <ScoreBar
                    label="Price competitiveness"
                    value={priceScore}
                    weight={0.2}
                    color="alert"
                    hint={s.priceIndex > 100 ? `${s.priceIndex} — premium` : s.priceIndex < 100 ? `${s.priceIndex} — discount` : `${s.priceIndex} — at par`}
                  />
                </div>

                {/* Lead time + composite */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line/70 bg-ink/40 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Avg lead time</p>
                    <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-paper">
                      {s.avgLeadTimeDays}<span className="text-sm text-mist">d</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-ink/40 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Composite</p>
                    <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-signal">
                      {composite.toFixed(1)}<span className="text-sm text-mist/60">/100</span>
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiMini({
  label,
  value,
  hint,
  tone = 'mist',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'signal' | 'critical' | 'mist'
}) {
  const toneClass = { signal: 'text-signal', critical: 'text-critical', mist: 'text-paper' }[tone]
  return (
    <div className="rounded-lg border border-line bg-panel/60 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className={`mt-0.5 font-display text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-mist/80">{hint}</p>}
    </div>
  )
}

function ScoreBar({
  label,
  value,
  weight,
  color,
  hint,
}: {
  label: string
  value: number
  weight: number
  color: 'signal' | 'alert'
  hint?: string
}) {
  const widthPct = Math.max(0, Math.min(100, value))
  const colorClass = color === 'signal' ? 'bg-signal' : 'bg-alert'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-mist">{label}</span>
        <span className="font-mono text-paper">
          {value.toFixed(0)}<span className="text-mist/60"> · {Math.round(weight * 100)}%</span>
          {hint && <span className="ml-1 text-mist/60">· {hint}</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/60">
        <div
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  )
}
