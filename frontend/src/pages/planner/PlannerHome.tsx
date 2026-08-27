import { useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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

const CHART_COLORS = {
  signal: '#2FE3C4',
  warning: '#F2A93B',
  critical: '#F0555C',
  muted: '#8593AF',
  panel: '#111A2C',
  line: '#22314D',
  paper: '#EEF1F7',
}

const chartTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 15, 28, 0.96)',
    border: '1px solid rgba(133, 147, 175, 0.22)',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.34)',
    color: CHART_COLORS.paper,
  },
  cursor: { fill: 'rgba(47, 227, 196, 0.06)' },
  labelStyle: { color: CHART_COLORS.paper, fontWeight: 700 },
  itemStyle: { color: CHART_COLORS.paper, fontSize: 12 },
  wrapperStyle: { outline: 'none' },
}

const gridProps = {
  stroke: CHART_COLORS.line,
  strokeDasharray: '4 8',
  strokeOpacity: 0.52,
  vertical: false,
}

const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: CHART_COLORS.muted, fontSize: 11 },
  interval: 0,
}

const legendProps = {
  iconType: 'circle' as const,
  wrapperStyle: { color: CHART_COLORS.paper, fontSize: 11, paddingTop: 6 },
}

const chartMargins = {
  bar: { top: 16, right: 28, bottom: 8, left: 8 },
  line: { top: 16, right: 32, bottom: 8, left: 8 },
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

  const volumeData = useMemo(
    () => [
      { name: 'SKUs', value: metrics?.skuCount ?? 0, fill: CHART_COLORS.signal },
      { name: 'DCs', value: metrics?.dcCount ?? 0, fill: CHART_COLORS.warning },
      { name: 'Reorder', value: metrics?.reorderAlertCount ?? 0, fill: CHART_COLORS.critical },
      { name: 'Expiry', value: metrics?.expiryRiskCount ?? 0, fill: CHART_COLORS.muted },
    ],
    [metrics],
  )

  const healthData = useMemo(() => {
    const reorder = metrics?.reorderAlertCount ?? 0
    const expiry = metrics?.expiryRiskCount ?? 0
    const totalSkus = metrics?.skuCount ?? 0
    return [
      { label: 'Stable', value: Math.max(0, totalSkus - reorder - expiry), fill: CHART_COLORS.signal },
      { label: 'Reorder', value: reorder, fill: CHART_COLORS.warning },
      { label: 'Expiry', value: expiry, fill: CHART_COLORS.critical },
    ]
  }, [metrics])
  const trendData = useMemo(
    () => [
      { day: 'Mon', demand: 34, inventory: 76 },
      { day: 'Tue', demand: 41, inventory: 72 },
      { day: 'Wed', demand: 38, inventory: 68 },
      { day: 'Thu', demand: 56, inventory: 63 },
      { day: 'Fri', demand: 51, inventory: 59 },
      { day: 'Sat', demand: 64, inventory: 54 },
      { day: 'Sun', demand: 58, inventory: 51 },
    ],
    [],
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="animate-rise-in">
        <h2 className="font-display text-xl font-semibold tracking-tight text-paper md:text-2xl">
          {greeting(new Date().getHours())}
          {!userLoading && user ? `, ${user.name.split(' ')[0]}` : ''}.
        </h2>
        <p className="mt-1 text-xs text-mist">
          {userLoading ? 'Syncing your session...' : `Watching ${user?.dc} and the wider MedCare Pharma network.`}
        </p>
      </div>

      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Live planning model</p>
        <h3 className="font-display text-xl font-semibold tracking-tight text-paper">
          Inventory, expiry, and demand signals in one operating view.
        </h3>
        <p className="max-w-3xl text-xs leading-relaxed text-mist">
          Demand pressure flows into replenishment decisions, then into DC stock and expiry risk.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Network" value={metricsState === 'ok' ? 'Synced' : metricsState === 'loading' ? 'Syncing' : 'Offline'} />
          <MiniStat label="Flow" value={`${metrics?.reorderAlertCount ?? 0} alerts`} tone={metricsState === 'error' ? 'critical' : (metrics?.reorderAlertCount ?? 0) > 0 ? 'critical' : 'signal'} />
          <MiniStat label="Risk" value={`${metrics?.expiryRiskCount ?? 0} batches`} tone={metricsState === 'error' ? 'critical' : (metrics?.expiryRiskCount ?? 0) > 0 ? 'critical' : 'signal'} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartPanel title="Planning Volume" subtitle="SKUs, DCs, reorder alerts, and expiry risk counts" className="lg:col-span-1">
          <ChartShell height={220}>
            <BarChart data={volumeData} margin={chartMargins.bar} barCategoryGap="32%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} dy={4} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <YAxis {...axisProps} allowDecimals={false} width={44} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={48}>
                {volumeData.map((item) => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartShell>
        </ChartPanel>

        <ChartPanel title="Inventory Health" subtitle="Stable SKUs versus reorder and expiry pressure" className="lg:col-span-1">
          <DonutChart data={healthData} total={metrics?.skuCount ?? healthData.reduce((sum, item) => sum + item.value, 0)} label="SKUs" />
        </ChartPanel>

        <ChartPanel title="Demand vs Inventory" subtitle="Weekly sensed demand against on-hand inventory" className="lg:col-span-1">
          <ChartShell height={220}>
            <LineChart data={trendData} margin={chartMargins.line}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="day" {...axisProps} dy={4} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <YAxis {...axisProps} width={44} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <Tooltip {...chartTooltipProps} />
              <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, paddingTop: 4 }} />
              <Line type="monotone" dataKey="demand" name="Demand" stroke={CHART_COLORS.warning} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} strokeLinecap="round" />
              <Line type="monotone" dataKey="inventory" name="Inventory" stroke={CHART_COLORS.signal} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} strokeLinecap="round" />
            </LineChart>
          </ChartShell>
        </ChartPanel>
      </section>

      <p className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-mist/70">
        Demo planner session active
      </p>
    </div>
  )
}

function ChartShell({ height, children }: { height: number; children: ReactElement }) {
  return (
    <div
      className="relative rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(17,26,44,0.78),rgba(10,15,28,0.48))] shadow-inner shadow-white/5"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function DonutChart({ data, total, label }: { data: { label: string; value: number; fill: string }[]; total: number; label: string }) {
  const chartData = total > 0 ? data : [{ label: 'No data', value: 1, fill: 'rgba(133, 147, 175, 0.28)' }]
  const centerLabel = total > 0 ? total.toLocaleString() : '0'

  return (
    <div
      className="relative rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(17,26,44,0.78),rgba(10,15,28,0.48))] shadow-inner shadow-white/5"
      style={{ height: 220 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <filter id="donutHealthGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={68}
            paddingAngle={total > 0 ? 5 : 0}
            cornerRadius={8}
            stroke={CHART_COLORS.panel}
            strokeWidth={4}
            isAnimationActive={false}
            label={total > 0 ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : undefined}
            labelLine={false}
          >
            {chartData.map((item) => (
              <Cell key={item.label} fill={item.fill} filter={total > 0 ? 'url(#donutHealthGlow)' : undefined} />
            ))}
          </Pie>
          <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill={CHART_COLORS.paper} className="font-display text-xl font-semibold">
            {centerLabel}
          </text>
          <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" fill={CHART_COLORS.muted} className="font-mono text-[9px] uppercase tracking-[0.18em]">
            {label}
          </text>
          <Tooltip {...chartTooltipProps} formatter={(value: number) => [total > 0 ? value.toLocaleString() : '0', label]} />
          {total > 0 && <Legend {...legendProps} verticalAlign="bottom" wrapperStyle={{ ...legendProps.wrapperStyle, paddingTop: 2, fontSize: 10 }} />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function MiniStat({ label, value, tone = 'signal' }: { label: string; value: string; tone?: 'signal' | 'warning' | 'critical' | 'mist' }) {
  const toneClass = { signal: 'text-signal', warning: 'text-alert', critical: 'text-critical', mist: 'text-paper/40' }[tone]
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-2.5 shadow-sm shadow-ink/20">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function ChartPanel({ title, subtitle, children, className = '' }: { title: string; subtitle: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-white/10 bg-panel/80 shadow-xl shadow-ink/20 ${className}`}>
      <div className="border-b border-white/10 px-3 py-2">
        <h3 className="font-display text-sm font-semibold tracking-tight text-paper truncate">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-mist line-clamp-2">{subtitle}</p>
      </div>
      <div className="flex-1 p-2.5">{children}</div>
    </section>
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
    <div className="animate-rise-in rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(17,26,44,0.86),rgba(17,26,44,0.62))] p-3 shadow-lg shadow-ink/20">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mist/80">{caption}</p>
    </div>
  )
}