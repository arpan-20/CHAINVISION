import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { p1Client } from '../../api/p1Client'
import { ChevronIcon, CrateIcon, HourglassIcon, PulseIcon, RouteIcon } from '../../components/icons'
import { useAuthStub } from '../../hooks/useAuthStub'

interface SkuSummary {
  id: string
  skuCode: string
  name: string
}

interface DistributionCenterSummary {
  id: string
}

interface RecommendationSummary {
  status: 'NEW' | 'SENT_TO_PROCUREMENT' | 'ACKNOWLEDGED'
}

interface BatchSummary {
  daysUntilExpiry: number
}

type FetchState = 'loading' | 'ok' | 'error'

const MODULES = [
  {
    to: '/planner/inventory',
    icon: CrateIcon,
    title: 'Inventory',
    description: 'Stock on hand by SKU, DC, and batch — with expiry dates attached.',
  },
  {
    to: '/planner/expiry-risk',
    icon: HourglassIcon,
    title: 'Expiry Risk',
    description: 'Batches ranked by how much shelf life is left before write-off.',
  },
  {
    to: '/planner/replenishment',
    icon: RouteIcon,
    title: 'Replenishment Recommendations',
    description: 'SKUs past reorder point, with EOQ and FEFO-aware quantities.',
  },
  {
    to: '/planner/demand-signals',
    icon: PulseIcon,
    title: 'Demand Signals',
    description: 'Sensed demand vs. forecast, by region — flu-season spikes included.',
  },
] as const

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function PlannerHome() {
  const { user, loading: userLoading } = useAuthStub()
  const [skus, setSkus] = useState<SkuSummary[]>([])
  const [distributionCenters, setDistributionCenters] = useState<DistributionCenterSummary[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationSummary[]>([])
  const [expiringBatches, setExpiringBatches] = useState<BatchSummary[]>([])
  const [skuState, setSkuState] = useState<FetchState>('loading')

  useEffect(() => {
    let cancelled = false

    Promise.all([
      p1Client.get<{ data: SkuSummary[] }>('/skus'),
      p1Client.get<{ data: DistributionCenterSummary[] }>('/distribution-centers'),
      p1Client.get<{ data: RecommendationSummary[] }>('/replenishment/recommendations'),
      p1Client.get<{ data: { batches: BatchSummary[] } }>('/inventory', { params: { detail: 'batches' } }),
    ])
      .then(([skuResponse, dcResponse, recommendationResponse, inventoryResponse]) => {
        if (cancelled) return
        setSkus(skuResponse.data.data)
        setDistributionCenters(dcResponse.data.data)
        setRecommendations(recommendationResponse.data.data)
        setExpiringBatches(
          inventoryResponse.data.data.batches.filter((batch) => batch.daysUntilExpiry <= 7),
        )
        setSkuState('ok')
      })
      .catch(() => {
        if (!cancelled) setSkuState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Greeting */}
      <div className="animate-rise-in">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-paper md:text-3xl">
          {greeting(new Date().getHours())}
          {!userLoading && user ? `, ${user.name.split(' ')[0]}` : ''}.
        </h2>
        <p className="mt-1.5 text-sm text-mist">
          {userLoading ? 'Syncing your session…' : `Watching ${user?.dc} and the wider MedCare Pharma network.`}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiTile
          label="SKUs tracked"
          value={skuState === 'ok' ? String(skus.length) : skuState === 'error' ? 'Offline' : '···'}
          tone={skuState === 'error' ? 'critical' : 'signal'}
          caption={skuState === 'error' ? 'Check P1 API connection' : 'Live from P1 API'}
        />
        <KpiTile
          label="Distribution centers"
          value={skuState === 'ok' ? String(distributionCenters.length) : skuState === 'error' ? 'Offline' : '···'}
          tone={skuState === 'error' ? 'critical' : 'signal'}
          caption={skuState === 'error' ? 'Check P1 API connection' : 'Live from P1 API'}
        />
        <KpiTile
          label="Reorder alerts"
          value={skuState === 'ok' ? String(recommendations.filter(({ status }) => status !== 'ACKNOWLEDGED').length) : skuState === 'error' ? 'Offline' : '···'}
          tone={skuState === 'error' ? 'critical' : 'signal'}
          caption={skuState === 'error' ? 'Check P1 API connection' : 'Open recommendations'}
        />
        <KpiTile
          label="Expiry risk (7d)"
          value={skuState === 'ok' ? String(expiringBatches.length) : skuState === 'error' ? 'Offline' : '···'}
          tone={skuState === 'error' ? 'critical' : 'signal'}
          caption={skuState === 'error' ? 'Check P1 API connection' : 'Batches expiring within 7 days'}
        />
      </div>

      {/* Module cards */}
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Planning modules</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODULES.map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-4 rounded-xl border border-line bg-panel p-5 transition-colors hover:border-signal/40 hover:bg-panel2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-signal transition-transform group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold text-paper">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-mist">{description}</p>
              </div>
              <ChevronIcon className="mt-1 h-4 w-4 shrink-0 text-mist transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
            </Link>
          ))}
        </div>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist/70">
        Running on a temporary auth stub — Phase 23 swaps in Supabase Auth.
      </p>
    </div>
  )
}

function KpiTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string
  value: string
  caption: string
  tone: 'signal' | 'critical' | 'mist'
}) {
  const toneClass = { signal: 'text-signal', critical: 'text-critical', mist: 'text-paper/40' }[tone]
  return (
    <div className="animate-rise-in rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-mist/80">{caption}</p>
    </div>
  )
}
