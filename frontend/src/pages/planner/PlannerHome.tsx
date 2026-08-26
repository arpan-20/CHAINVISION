import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { p1Client } from '../../api/p1Client'
import { ChevronIcon, CrateIcon, HourglassIcon, PulseIcon, RouteIcon } from '../../components/icons'
import { useAuth } from '../../hooks/useAuth'

interface SkuSummary {
  id: string
  skuCode: string
  name: string
}

interface DistributionCenterSummary {
  id: string
}

interface RecommendationSummary {
  id: string
  status: 'NEW' | 'SENT_TO_PROCUREMENT' | 'ACKNOWLEDGED'
}

interface InventoryBatchRisk {
  id: string
  quantity: number
  daysUntilExpiry: number
}

type FetchState = 'loading' | 'ok' | 'error'

interface PlannerMetrics {
  skuCount: number
  dcCount: number
  reorderAlertCount: number
  expiryRiskCount: number
}

const MODULES = [
  {
    to: '/planner/inventory',
    icon: CrateIcon,
    title: 'Inventory',
    description: 'Stock on hand by SKU, DC, and batch, with expiry dates attached.',
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
    description: 'Sensed demand vs. forecast, by region, including flu-season spikes.',
  },
] as const

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function PlannerHome() {
  const { user, loading: userLoading } = useAuth()
  const [metrics, setMetrics] = useState<PlannerMetrics | null>(null)
  const [metricsState, setMetricsState] = useState<FetchState>('loading')

  useEffect(() => {
    let cancelled = false

    Promise.all([
      p1Client.get<{ data: SkuSummary[] }>('/skus'),
      p1Client.get<{ data: DistributionCenterSummary[] }>('/distribution-centers'),
      p1Client.get<{ data: RecommendationSummary[] }>('/replenishment/recommendations'),
      p1Client.get<{ data: { batches: InventoryBatchRisk[] } }>('/inventory', {
        params: { detail: 'batches' },
      }),
    ])
      .then(([skuRes, dcRes, recommendationRes, inventoryRes]) => {
        if (cancelled) return

        setMetrics({
          skuCount: skuRes.data.data.length,
          dcCount: dcRes.data.data.length,
          reorderAlertCount: recommendationRes.data.data.filter((rec) => rec.status === 'NEW').length,
          expiryRiskCount: inventoryRes.data.data.batches.filter(
            (batch) => batch.quantity > 0 && batch.daysUntilExpiry <= 7,
          ).length,
        })
        setMetricsState('ok')
      })
      .catch(() => {
        if (!cancelled) setMetricsState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="animate-rise-in">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-paper md:text-3xl">
          {greeting(new Date().getHours())}
          {!userLoading && user ? `, ${user.name.split(' ')[0]}` : ''}.
        </h2>
        <p className="mt-1.5 text-sm text-mist">
          {userLoading ? 'Syncing your session...' : `Watching ${user?.dc} and the wider MedCare Pharma network.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiTile
          label="SKUs tracked"
          value={metricValue(metricsState, metrics?.skuCount)}
          tone={metricsState === 'error' ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check P1 API connection' : 'Live from P1 API'}
        />
        <KpiTile
          label="Distribution centers"
          value={metricValue(metricsState, metrics?.dcCount)}
          tone={metricsState === 'error' ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check P1 API connection' : 'Active network nodes'}
        />
        <KpiTile
          label="Reorder alerts"
          value={metricValue(metricsState, metrics?.reorderAlertCount)}
          tone={metricsState === 'error' ? 'critical' : (metrics?.reorderAlertCount ?? 0) > 0 ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check P1 API connection' : 'NEW recommendations'}
        />
        <KpiTile
          label="Expiry risk (7d)"
          value={metricValue(metricsState, metrics?.expiryRiskCount)}
          tone={metricsState === 'error' ? 'critical' : (metrics?.expiryRiskCount ?? 0) > 0 ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check P1 API connection' : 'Batches nearing expiry'}
        />
      </div>

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
        Demo planner session active
      </p>
    </div>
  )
}

function metricValue(state: FetchState, value: number | undefined) {
  if (state === 'error') return 'Offline'
  if (state === 'loading') return '...'
  return String(value ?? 0)
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
