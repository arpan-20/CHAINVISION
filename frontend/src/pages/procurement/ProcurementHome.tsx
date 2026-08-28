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

import { pr2Client } from '../../api/pr2Client'
import RealDataAiInsightBanner from '../../components/RealDataAiInsightBanner'
import RealDataLiveActivityFeed from '../../components/RealDataLiveActivityFeed'
import SupplyNetwork3D from '../../components/SupplyNetwork3D'
import { useCountUp, useMounted } from '../../hooks/useMotion'
import { useAuth } from '../../hooks/useAuth'

interface SupplierSummary {
  id: string
  name: string
  priceIndex: number
  avgLeadTimeDays: number
  otdScore: number
  qualityScore: number
  capacityUnits: number
}

interface RequisitionSummary {
  id: string
  status: 'CREATED' | 'SOURCED' | 'PO_RAISED'
}

interface PurchaseOrderSummary {
  id: string
  status: 'ISSUED' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED'
}

interface ExceptionSummary {
  invoice: {
    id: string
  }
}

type FetchState = 'loading' | 'ok' | 'error'

interface ProcurementMetrics {
  supplierCount: number
  openRequisitionCount: number
  poAwaitingReceiptCount: number
  exceptionCount: number
  totalPurchaseOrders: number
  closedPurchaseOrders: number
  supplierQualityAverage: number
  supplierLeadTimeAverage: number
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

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ──────────────────────────────────────────────
   ANIMATED COUNT-UP KPI TILE
   ────────────────────────────────────────────── */
function AnimatedKpiTile({
  label,
  value,
  tone,
  caption,
  suffix = '',
  delay = 0,
  className = '',
}: {
  label: string
  value: number
  tone: 'signal' | 'critical' | 'mist'
  caption: string
  suffix?: string
  delay?: number
  className?: string
}) {
  const display = useCountUp(value, 1100, delay)
  const toneClass = { signal: 'text-signal', critical: 'text-critical', mist: 'text-paper/40' }[tone]
  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(17,26,44,0.86),rgba(17,26,44,0.62))] p-3 shadow-lg shadow-ink/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-signal/30 hover:shadow-signal/10 ${className}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-signal/0 blur-xl transition-all duration-500 group-hover:bg-signal/20" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tracking-tight tabular-nums ${toneClass}`}>
        {Math.round(display).toLocaleString()}
        <span className="ml-0.5 text-sm text-mist/70">{suffix}</span>
      </p>
      <p className="mt-0.5 text-[10px] text-mist/80">{caption}</p>
    </div>
  )
}

export default function ProcurementHome() {
  const { user, loading: userLoading } = useAuth()
  const [metrics, setMetrics] = useState<ProcurementMetrics | null>(null)
  const [metricsState, setMetricsState] = useState<FetchState>('loading')
  const mounted = useMounted(50)

  useEffect(() => {
    let cancelled = false

    const loadOverview = async () => {
      const [supplierResult, requisitionResult, poResult] = await Promise.all([
        pr2Client.get<SupplierSummary[]>('/suppliers'),
        pr2Client.get<RequisitionSummary[]>('/requisitions'),
        pr2Client.get<PurchaseOrderSummary[]>('/purchase-orders'),
      ])

      if (cancelled) return

      const suppliers = supplierResult.data
      const purchaseOrders = poResult.data
      const supplierQualityAverage = suppliers.length
        ? suppliers.reduce((sum, supplier) => sum + supplier.qualityScore, 0) / suppliers.length
        : 0
      const supplierLeadTimeAverage = suppliers.length
        ? suppliers.reduce((sum, supplier) => sum + supplier.avgLeadTimeDays, 0) / suppliers.length
        : 0

      setMetrics({
        supplierCount: suppliers.length,
        openRequisitionCount: requisitionResult.data.filter((req) => req.status !== 'PO_RAISED').length,
        poAwaitingReceiptCount: purchaseOrders.filter((po) =>
          ['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(po.status),
        ).length,
        exceptionCount: 0,
        totalPurchaseOrders: purchaseOrders.length,
        closedPurchaseOrders: purchaseOrders.filter((po) => ['RECEIVED', 'CLOSED'].includes(po.status)).length,
        supplierQualityAverage,
        supplierLeadTimeAverage,
      })
      setMetricsState('ok')

      try {
        const exceptionResult = await pr2Client.get<ExceptionSummary[]>('/exceptions')
        if (!cancelled) {
          setMetrics((current) => (current ? { ...current, exceptionCount: exceptionResult.data.length } : current))
        }
      } catch {
        // The exception queue is slower than the overview queries; keep the other KPIs usable.
      }
    }

    void loadOverview().catch(() => {
      if (!cancelled) setMetricsState('error')
    })

    return () => {
      cancelled = true
    }
  }, [])

  const volumeData = useMemo(
    () => [
      { name: 'Suppliers', value: metrics?.supplierCount ?? 0, fill: CHART_COLORS.warning },
      { name: 'Open PRs', value: metrics?.openRequisitionCount ?? 0, fill: CHART_COLORS.signal },
      { name: 'Dock', value: metrics?.poAwaitingReceiptCount ?? 0, fill: CHART_COLORS.muted },
      { name: 'Exceptions', value: metrics?.exceptionCount ?? 0, fill: CHART_COLORS.critical },
    ],
    [metrics],
  )

  const poStatusData = useMemo(
    () => [
      { label: 'Closed', value: metrics?.closedPurchaseOrders ?? 0, fill: CHART_COLORS.signal },
      { label: 'In flight', value: Math.max(0, (metrics?.totalPurchaseOrders ?? 0) - (metrics?.closedPurchaseOrders ?? 0)), fill: CHART_COLORS.warning },
      { label: 'Exceptions', value: metrics?.exceptionCount ?? 0, fill: CHART_COLORS.critical },
    ],
    [metrics],
  )

  const cycleData = useMemo(
    () => [
      { step: 'PR', cycle: 11, target: 14 },
      { step: 'Source', cycle: 18, target: 20 },
      { step: 'PO', cycle: 25, target: 28 },
      { step: 'GRN', cycle: 33, target: 36 },
      { step: 'Invoice', cycle: 42, target: 48 },
      { step: 'Pay', cycle: 50, target: 60 },
    ],
    [],
  )

  return (
    <div
      className={`mx-auto flex max-w-6xl flex-col gap-4 transition-all duration-700 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      {/* ── Cinematic 3D Hero ───────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-panel/60 to-ink/80 shadow-2xl shadow-ink/40">
        <div className="absolute inset-0 opacity-90">
          <SupplyNetwork3D height={300} />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/70 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent"
          aria-hidden="true"
        />

        <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
          <div className="flex items-center gap-2 text-signal">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal shadow-[0_0_8px_rgba(47,227,196,0.7)]" />
            <span>Live procurement</span>
          </div>
          <div className="hidden items-center gap-3 text-mist/70 sm:flex">
            <span>5 suppliers</span>
            <span className="h-3 w-px bg-mist/20" />
            <span>{metricsState === 'ok' ? 'Synced' : 'Syncing'}</span>
            <span className="h-3 w-px bg-mist/20" />
            <span>P2P flow active</span>
          </div>
        </div>

        <div className="relative z-10 px-5 pb-6 pt-14 sm:px-8 sm:pt-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-alert/80">Live procurement model</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-4xl">
            {greeting(new Date().getHours())}
            {!userLoading && user ? `, ${user.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-mist">
            Watching procure-to-pay across <span className="text-paper">{user?.dc ?? 'your network'}</span> and the wider MedCare Pharma network.
            Sourcing health, open dock work, and exception pressure in one flow.
          </p>
        </div>
      </div>

      {/* ── AI Insight Banner ───────────────────────── */}
      <RealDataAiInsightBanner />

      {/* ── KPI tiles (count-up) ───────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <AnimatedKpiTile
          label="Suppliers onboarded"
          value={metrics?.supplierCount ?? 0}
          delay={0}
          tone={metricsState === 'error' ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Live from PR2 API'}
        />
        <AnimatedKpiTile
          label="Open requisitions"
          value={metrics?.openRequisitionCount ?? 0}
          delay={80}
          tone={metricsState === 'error' ? 'critical' : (metrics?.openRequisitionCount ?? 0) > 0 ? 'signal' : 'mist'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Awaiting PO creation'}
        />
        <AnimatedKpiTile
          label="POs awaiting receipt"
          value={metrics?.poAwaitingReceiptCount ?? 0}
          delay={160}
          tone={metricsState === 'error' ? 'critical' : (metrics?.poAwaitingReceiptCount ?? 0) > 0 ? 'signal' : 'mist'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Open dock confirmations'}
        />
        <AnimatedKpiTile
          label="Exceptions queued"
          value={metrics?.exceptionCount ?? 0}
          delay={240}
          tone={metricsState === 'error' ? 'critical' : (metrics?.exceptionCount ?? 0) > 0 ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Needs human review'}
        />
      </div>

      {/* ── Charts + Live activity feed ───────────────────────── */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <ChartPanel title="P2P Volume" subtitle="Suppliers, requisitions, dock work, and exceptions" className="lg:col-span-1">
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

        <ChartPanel title="PO Completion" subtitle="Closed, in flight, and exception counts" className="lg:col-span-1">
          <DonutChart data={poStatusData} total={metrics?.totalPurchaseOrders ?? poStatusData.reduce((sum, item) => sum + item.value, 0)} label="POs" />
        </ChartPanel>

        <ChartPanel title="Cycle Time by Stage" subtitle="Hours at each P2P step versus target" className="lg:col-span-1">
          <ChartShell height={220}>
            <LineChart data={cycleData} margin={chartMargins.line}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="step" {...axisProps} dy={4} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <YAxis {...axisProps} width={44} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <Tooltip {...chartTooltipProps} />
              <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, paddingTop: 4 }} />
              <Line type="monotone" dataKey="cycle" name="Cycle" stroke={CHART_COLORS.warning} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} strokeLinecap="round" />
              <Line type="monotone" dataKey="target" name="Target" stroke={CHART_COLORS.signal} strokeWidth={2.25} dot={false} strokeDasharray="3 7" strokeLinecap="round" />
            </LineChart>
          </ChartShell>
        </ChartPanel>

        <div className="lg:col-span-1">
                  <RealDataLiveActivityFeed className="h-[220px]" />
                </div>
      </section>
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
            <filter id="donutCompletionGlow" x="-40%" y="-40%" width="180%" height="180%">
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
              <Cell key={item.label} fill={item.fill} filter={total > 0 ? 'url(#donutCompletionGlow)' : undefined} />
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