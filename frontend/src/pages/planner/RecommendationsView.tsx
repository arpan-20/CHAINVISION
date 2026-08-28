import { useEffect, useMemo, useState } from 'react'

import { p1Client } from '../../api/p1Client'
import { RefreshButton, UrgencyBadge, type Urgency } from '../../components/badges'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useRealtimeTable } from '../../hooks/useRealtimeTable'
import { formatINR } from '../../lib/format'
import DemandSpikeSimulator from './DemandSpikeSimulator'

interface Recommendation {
  id: string
  skuId: string
  dcId: string
  recommendedQty: number
  reorderPoint: number
  safetyStock: number
  eoq: number
  urgency: Urgency
  reasonCode: string
  aiRationale: string
  status: 'NEW' | 'SENT_TO_PROCUREMENT' | 'ACKNOWLEDGED'
  createdAt: string
}

type LoadState = 'loading' | 'ok' | 'error'

const URGENCY_ORDER: Record<Urgency, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export default function RecommendationsView() {
  const { skus, dcs, skuById, dcById } = useReferenceData()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | ''>('')

  const load = () => {
    setState('loading')
    const params = urgencyFilter ? { urgency: urgencyFilter } : {}
    p1Client
      .get<{ data: Recommendation[] }>('/replenishment/recommendations', { params })
      .then((response) => {
        setRecommendations(
          [...response.data.data].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]),
        )
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [urgencyFilter])
  useRealtimeTable('p1', 'replenishment_recommendations', load)

  // Aggregate ₹ value of all open recommendations (the headline "this is how much $$ we're committing" number)
  const totalRecommendedValue = useMemo(() => {
    return recommendations.reduce((sum, rec) => {
      const sku = skuById.get(rec.skuId)
      const unitCost = sku?.unitCost ?? 0
      return sum + unitCost * rec.recommendedQty
    }, 0)
  }, [recommendations, skuById])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
            Replenishment recommendations
          </h2>
          <p className="mt-1 text-sm text-mist">
            SKUs past their reorder point, with EOQ-based quantity and urgency - ready to hand off to procurement.
          </p>
        </div>
        {totalRecommendedValue > 0 && (
          <div className="rounded-lg border border-signal/30 bg-signal/5 px-4 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-signal/80">Total PO value</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-signal">
              {formatINR(totalRecommendedValue)}
            </p>
          </div>
        )}
      </div>

      <DemandSpikeSimulator skus={skus} dcs={dcs} onRecommendationsUpdated={load} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value as Urgency | '')}
          className="field-control"
        >
          <option value="">All urgencies</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      {state === 'error' ? (
        <p className="rounded-xl panel-soft p-6 text-sm text-critical">
          Couldn't reach the P1 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl panel-soft" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <p className="rounded-xl panel-soft p-6 text-sm text-mist">
          No open recommendations. Trigger a demand spike above, or check back after the next
          recalculation.
        </p>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const sku = skuById.get(rec.skuId)
            const unitCost = sku?.unitCost ?? 0
            const recommendedValue = unitCost * rec.recommendedQty
            return (
            <div
              key={rec.id}
              className="animate-rise-in rounded-xl panel-soft p-5 transition-colors hover:border-signal/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold text-paper">
                    {skuById.get(rec.skuId)?.skuCode ?? rec.skuId}
                    <span className="ml-2 font-body text-sm font-normal text-mist">
                      {skuById.get(rec.skuId)?.name}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-mist">
                    {dcById.get(rec.dcId)?.dcCode ?? rec.dcId} . {dcById.get(rec.dcId)?.name} . {rec.reasonCode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <UrgencyBadge urgency={rec.urgency} />
                  <StatusPill status={rec.status} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Recommended qty"
                  value={rec.recommendedQty.toLocaleString() + (recommendedValue > 0 ? ` · ${formatINR(recommendedValue)}` : '')}
                  highlight
                />
                <Stat label="Reorder point" value={rec.reorderPoint.toLocaleString()} />
                <Stat label="Safety stock" value={rec.safetyStock.toLocaleString()} />
                <Stat label="EOQ" value={rec.eoq.toLocaleString()} />
              </div>

              <div className="mt-4 rounded-lg border border-line/70 bg-ink/40 px-3.5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-mist">AI rationale</p>
                <p className="mt-1 text-sm text-paper/90">
                  {rec.aiRationale || (
                    <span className="italic text-mist">Rationale is not available for this recommendation yet.</span>
                  )}
                </p>
              </div>

              <p className="mt-3 text-right font-mono text-[10px] uppercase tracking-wider text-mist/70">
                {new Date(rec.createdAt).toLocaleString()}
              </p>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${highlight ? 'text-signal' : 'text-paper'}`}>{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: Recommendation['status'] }) {
  const styles: Record<Recommendation['status'], string> = {
    NEW: 'text-mist border-line bg-panel2',
    SENT_TO_PROCUREMENT: 'text-signal border-signal/30 bg-signal/10',
    ACKNOWLEDGED: 'text-paper border-line bg-panel2',
  }
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

