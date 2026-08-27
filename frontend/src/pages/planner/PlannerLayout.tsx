import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { p1Client } from '../../api/p1Client'
import NavBar from '../../components/NavBar'
import { useAuth } from '../../hooks/useAuth'
import { useReferenceData } from '../../hooks/useReferenceData'

const PAGE_TITLES: Record<string, string> = {
  '/planner': 'Overview',
  '/planner/inventory': 'Inventory',
  '/planner/expiry-risk': 'Expiry Risk',
  '/planner/replenishment': 'Replenishment Recommendations',
  '/planner/demand-signals': 'Demand Signals',
}

// Fallback network activity for the manifest ticker, shown until the
// live recommendations feed loads (or if it comes back empty). One
// fetch on mount — no polling here, Phase 21 owns realtime refresh.
const FALLBACK_FEED_ITEMS = [
  { tag: 'FEFO', text: 'DC-KOL → DC-PTN · Batch #A231 sequenced', tone: 'signal' as const },
  { tag: 'ALERT', text: 'ROP breached · SKU AZT-250 · urgency HIGH', tone: 'alert' as const },
  { tag: 'GRN', text: 'GRN-00456 received · 1,200 units confirmed', tone: 'signal' as const },
  { tag: 'EXPIRY', text: 'Batch #C118 · 92% shelf life consumed', tone: 'critical' as const },
  { tag: 'DEMAND', text: 'Tier-2 flu-season spike detected · +58%', tone: 'alert' as const },
  { tag: 'EOQ', text: 'Replenishment qty computed · SKU PCM-500', tone: 'signal' as const },
]

const toneClass: Record<string, string> = {
  signal: 'text-signal border-signal/30 bg-signal/10',
  alert: 'text-alert border-alert/30 bg-alert/10',
  critical: 'text-critical border-critical/30 bg-critical/10',
}

interface RecommendationFeedRow {
  skuId: string
  dcId: string
  recommendedQty: number
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

const urgencyTone: Record<RecommendationFeedRow['urgency'], 'signal' | 'alert' | 'critical'> = {
  LOW: 'signal',
  MEDIUM: 'signal',
  HIGH: 'alert',
  CRITICAL: 'critical',
}

function ManifestTicker() {
  const { skuById, dcById } = useReferenceData()
  const [liveItems, setLiveItems] = useState<typeof FALLBACK_FEED_ITEMS | null>(null)

  useEffect(() => {
    let cancelled = false
    p1Client
      .get<{ data: RecommendationFeedRow[] }>('/replenishment/recommendations')
      .then((response) => {
        if (cancelled || response.data.data.length === 0) return
        setLiveItems(
          response.data.data.slice(0, 8).map((rec) => ({
            tag: rec.urgency,
            text: `${skuById.get(rec.skuId)?.skuCode ?? rec.skuId} → ${dcById.get(rec.dcId)?.dcCode ?? rec.dcId} · qty ${rec.recommendedQty.toLocaleString()}`,
            tone: urgencyTone[rec.urgency],
          })),
        )
      })
      .catch(() => {
        /* keep the fallback feed */
      })
    return () => {
      cancelled = true
    }
    // Re-derive labels once reference data resolves; still a single fetch.
  }, [skuById, dcById])

  const items = liveItems ?? FALLBACK_FEED_ITEMS
  const track = [...items, ...items]

  return (
    <div className="relative overflow-hidden border-b border-line bg-panel/60 py-2">
      <div className="fade-edges flex w-max animate-ticker gap-3 pl-4">
        {track.map((item, i) => (
          <span
            key={i}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] ${toneClass[item.tone]}`}
          >
            <span className="font-semibold tracking-wide">{item.tag}</span>
            <span className="text-mist">{item.text}</span>
          </span>
        ))}
      </div>
      
    </div>
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
  const { user } = useAuth()
  const now = useClock()

  const title = PAGE_TITLES[location.pathname] ?? 'Planner'
  const time = useMemo(
    () => now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [now],
  )

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-ink px-5 py-3.5 md:px-8">
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
          MedCare Pharma / Planner
        </p>
        <h1 className="truncate font-display text-lg font-semibold tracking-tight text-paper">{title}</h1>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {user && (
          <span className="hidden font-mono text-xs text-mist lg:inline">{user.dc}</span>
        )}
        <span className="flex items-center gap-1.5 font-mono text-xs text-mist">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" />
          {time}
        </span>
      </div>
    </header>
  )
}

export default function PlannerLayout() {
  return (
    <div className="flex h-screen bg-ink text-paper">
      <NavBar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <ManifestTicker />
        <main className="bg-grid flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
