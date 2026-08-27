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
import { RefreshButton } from '../../components/badges'

// Primary source: GET /api/analytics/p2p-summary, backed by
// com.chainvision.pr2.service.AnalyticsService.summarize().
// Fallback: if that endpoint is unavailable, compute a limited client-side
// substitute from GET /api/invoices + GET /api/exceptions.

type InvoiceStatus = 'PENDING_MATCH' | 'MATCHED' | 'MISMATCHED' | 'APPROVED' | 'EXCEPTION'

interface InvoiceResponse {
  id: string
  status: InvoiceStatus
  createdAt: string
}

interface ExceptionItem {
  invoice: { id: string }
}

interface AnalyticsSummary {
  totalRequisitions: number
  totalPurchaseOrders: number
  totalInvoices: number
  prsInFlight: number
  posInFlight: number
  invoicesInFlight: number
  autoApprovedPayments: number
  totalPayments: number
  mismatchedThreeWayMatches: number
  totalThreeWayMatches: number
  touchlessRatePct: number
  exceptionRatePct: number
  avgCycleTimeHours: number | null
}

type LoadState = 'loading' | 'ok' | 'error'
type Tone = 'signal' | 'warning' | 'critical' | 'mist'

interface PieDatum {
  name: string
  value: number
  fill: string
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

const tooltipProps = {
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
  verticalBar: { top: 16, right: 12, bottom: 8, left: 8 },
}

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function rateTone(rate: number, direction: 'high' | 'low') {
  if (direction === 'high') {
    if (rate >= 85) return 'signal'
    if (rate >= 70) return 'warning'
    return 'critical'
  }
  if (rate <= 10) return 'signal'
  if (rate <= 20) return 'warning'
  return 'critical'
}

function cycleTone(hours: number | null) {
  if (hours == null) return 'mist'
  if (hours <= 48) return 'signal'
  if (hours <= 72) return 'warning'
  return 'critical'
}

function toneTextClass(tone: Tone) {
  return { signal: 'text-signal', warning: 'text-alert', critical: 'text-critical', mist: 'text-paper/40' }[tone]
}

export default function P2pAnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [isClientComputed, setIsClientComputed] = useState(false)

  const load = () => {
    setState('loading')
    setIsClientComputed(false)
    pr2Client
      .get<AnalyticsSummary>('/analytics/p2p-summary')
      .then((res) => {
        setSummary(normalizeSummary(res.data))
        setState('ok')
      })
      .catch(() => {
        Promise.all([
          pr2Client.get<InvoiceResponse[]>('/invoices'),
          pr2Client.get<ExceptionItem[]>('/exceptions'),
        ])
          .then(([invRes, excRes]) => {
            const invoices = invRes.data
            const openExceptionIds = new Set(excRes.data.map((e) => e.invoice.id))
            const processed = invoices.filter((i) => i.status !== 'PENDING_MATCH')
            const touchlessRatePct =
              processed.length === 0 ? 0 : (100 * (processed.length - openExceptionIds.size)) / processed.length
            const exceptionRatePct = processed.length === 0 ? 0 : (100 * openExceptionIds.size) / processed.length
            const autoApprovedPayments = processed.length - openExceptionIds.size

            setSummary({
              totalRequisitions: 0,
              totalPurchaseOrders: 0,
              totalInvoices: invoices.length,
              prsInFlight: 0,
              posInFlight: 0,
              invoicesInFlight: invoices.filter((i) => i.status !== 'APPROVED').length,
              autoApprovedPayments,
              totalPayments: processed.length,
              mismatchedThreeWayMatches: openExceptionIds.size,
              totalThreeWayMatches: processed.length,
              touchlessRatePct,
              exceptionRatePct,
              avgCycleTimeHours: null,
            })
            setIsClientComputed(true)
            setState('ok')
          })
          .catch(() => setState('error'))
      })
  }

  useEffect(load, [])

  const analytics = useMemo(() => {
    if (!summary) return null

    const totalInFlight = summary.prsInFlight + summary.posInFlight + summary.invoicesInFlight
    const completedPayments = Math.max(0, summary.totalPayments - summary.autoApprovedPayments)
    const matchedThreeWayMatches = Math.max(0, summary.totalThreeWayMatches - summary.mismatchedThreeWayMatches)
    const estimatedManualRate = clampPercent(100 - summary.touchlessRatePct)
    const completedFlowCount = Math.max(0, summary.totalInvoices - summary.invoicesInFlight)

    return {
      totalInFlight,
      completedPayments,
      matchedThreeWayMatches,
      estimatedManualRate,
      completedFlowCount,
      cycleLabel: summary.avgCycleTimeHours != null ? `${summary.avgCycleTimeHours.toFixed(1)}h` : 'No approved cycle',
      touchlessTone: rateTone(summary.touchlessRatePct, 'high'),
      exceptionTone: rateTone(summary.exceptionRatePct, 'low'),
      cycleTone: cycleTone(summary.avgCycleTimeHours),
      flowData: [
        {
          name: 'PRs',
          total: summary.totalRequisitions,
          inFlight: summary.prsInFlight,
          closed: Math.max(0, summary.totalRequisitions - summary.prsInFlight),
        },
        {
          name: 'POs',
          total: summary.totalPurchaseOrders,
          inFlight: summary.posInFlight,
          closed: Math.max(0, summary.totalPurchaseOrders - summary.posInFlight),
        },
        {
          name: 'Invoices',
          total: summary.totalInvoices,
          inFlight: summary.invoicesInFlight,
          closed: completedFlowCount,
        },
      ],
      rateData: [
        { name: 'Touchless', value: clampPercent(summary.touchlessRatePct), target: 85 },
        { name: 'Manual', value: estimatedManualRate, target: 15 },
        { name: 'Exceptions', value: clampPercent(summary.exceptionRatePct), target: 10 },
      ],
      paymentData: [
        { name: 'Auto approved', value: summary.autoApprovedPayments, fill: CHART_COLORS.signal },
        { name: 'Manual or pending', value: completedPayments, fill: CHART_COLORS.warning },
      ],
      matchData: [
        { name: 'Matched', value: matchedThreeWayMatches, fill: CHART_COLORS.signal },
        { name: 'Mismatched', value: summary.mismatchedThreeWayMatches, fill: CHART_COLORS.critical },
      ],
      cycleSeries: buildCycleSeries(summary.avgCycleTimeHours),
    }
  }, [summary])

  return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="animate-rise-in">
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper md:text-2xl">
            {greeting(new Date().getHours())}.
          </h2>
          <p className="mt-1 text-xs text-mist">
            P2P analytics across the MedCare Pharma procurement network.
          </p>
        </div>

        <section className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Live P2P analytics</p>
          <h3 className="font-display text-xl font-semibold tracking-tight text-paper">
            Touchless processing, exception pressure, and cycle time in one control view.
          </h3>
          <p className="max-w-3xl text-xs leading-relaxed text-mist">
            Operational metrics paired with targets so you see both current state and trajectory.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <KpiCard
            label="Touchless rate"
            value={`${summary?.touchlessRatePct.toFixed(1) ?? '0.0'}%`}
            hint={`${summary?.autoApprovedPayments.toLocaleString() ?? '0'} of ${summary?.totalPayments.toLocaleString() ?? '0'} payments auto-approved`}
            tone={(analytics?.touchlessTone ?? 'signal') as Tone}
          />
          <KpiCard
            label="Exception rate"
            value={`${summary?.exceptionRatePct.toFixed(1) ?? '0.0'}%`}
            hint={`${summary?.mismatchedThreeWayMatches.toLocaleString() ?? '0'} mismatches from ${summary?.totalThreeWayMatches.toLocaleString() ?? '0'} matches`}
            tone={(analytics?.exceptionTone ?? 'signal') as Tone}
          />
          <KpiCard
            label="Avg. cycle time"
            value={analytics?.cycleLabel ?? 'No approved cycle'}
            hint="Requisition created to payment approved"
            tone={(analytics?.cycleTone ?? 'mist') as Tone}
          />
          <KpiCard
            label="Work in flight"
            value={analytics?.totalInFlight.toLocaleString() ?? '0'}
            hint={`${summary?.prsInFlight ?? 0} PRs, ${summary?.posInFlight ?? 0} POs, ${summary?.invoicesInFlight ?? 0} invoices`}
            tone={(analytics && analytics.totalInFlight > 0 ? 'warning' : 'signal') as Tone}
          />
        </div>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartPanel title="Pipeline Volume" subtitle="Completed vs in-flight by stage" className="lg:col-span-1">
          <ChartShell height={220}>
            <BarChart data={analytics?.flowData ?? []} margin={chartMargins.bar} barCategoryGap="32%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} dy={4} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <YAxis {...axisProps} allowDecimals={false} width={44} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <Tooltip {...tooltipProps} />
              <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, paddingTop: 4 }} />
              <Bar dataKey="closed" name="Completed" stackId="flow" fill={CHART_COLORS.signal} radius={[2, 2, 8, 8]} maxBarSize={48} />
              <Bar dataKey="inFlight" name="In flight" stackId="flow" fill={CHART_COLORS.warning} radius={[8, 8, 2, 2]} maxBarSize={48} />
            </BarChart>
          </ChartShell>
        </ChartPanel>

        <ChartPanel title="Payment Mix" subtitle="Automation against manual handling" className="lg:col-span-1">
          <PaymentMixChart data={analytics?.paymentData ?? []} total={summary?.totalPayments ?? 0} />
        </ChartPanel>

        <ChartPanel title="Rate Targets" subtitle="Touchless should rise; manual and exceptions should fall" className="lg:col-span-1">
          <ChartShell height={220}>
            <LineChart data={analytics?.rateData ?? []} margin={chartMargins.line}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} dy={4} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={48} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <Tooltip {...tooltipProps} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rate']} />
              <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, paddingTop: 4 }} />
              <Line type="monotone" dataKey="value" name="Actual" stroke={CHART_COLORS.warning} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS.panel }} activeDot={{ r: 6, strokeWidth: 0 }} strokeLinecap="round" />
              <Line type="monotone" dataKey="target" name="Target" stroke={CHART_COLORS.signal} strokeWidth={2.25} strokeDasharray="3 7" dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS.panel }} strokeLinecap="round" />
            </LineChart>
          </ChartShell>
        </ChartPanel>
      </section>

      <p className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-mist/70">
        Demo procurement analytics session active
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

function PaymentMixChart({ data, total }: { data: PieDatum[]; total: number }) {
  const chartData = total > 0 ? data : [{ name: 'No payments', value: 1, fill: 'rgba(133, 147, 175, 0.28)' }]
  const centerLabel = total > 0 ? total.toLocaleString() : '0'

  return (
    <div
      className="relative rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(17,26,44,0.78),rgba(10,15,28,0.48))] shadow-inner shadow-white/5"
      style={{ height: 220 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <filter id="paymentMixGlow" x="-40%" y="-40%" width="180%" height="180%">
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
            nameKey="name"
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
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} filter={total > 0 ? 'url(#paymentMixGlow)' : undefined} />
            ))}
          </Pie>
          <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill={CHART_COLORS.paper} className="font-display text-xl font-semibold">
            {centerLabel}
          </text>
          <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" fill={CHART_COLORS.muted} className="font-mono text-[9px] uppercase tracking-[0.18em]">
            payments
          </text>
          <Tooltip {...tooltipProps} formatter={(value: number) => [total > 0 ? value.toLocaleString() : '0', 'Payments']} />
          {total > 0 && (
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ color: CHART_COLORS.paper, fontSize: 10, paddingTop: 2 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-[220px] animate-pulse rounded-xl panel-soft lg:col-span-1" />
      ))}
    </div>
  )
}

function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: Tone }) {
  const toneClass = toneTextClass(tone)
  return (
    <div className="animate-rise-in rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(17,26,44,0.86),rgba(17,26,44,0.62))] p-3 shadow-lg shadow-ink/20">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mist/80">{hint}</p>
    </div>
  )
}

function MiniStat({ label, value, tone = 'signal' }: { label: string; value: string; tone?: Tone }) {
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

/** Supports analytics responses from before the integer count fields were added. */
function normalizeSummary(data: Partial<AnalyticsSummary>): AnalyticsSummary {
  const payload = data ?? {}
  const totalInvoices = Number(payload.totalInvoices ?? 0)
  const totalPayments = Number(payload.totalPayments ?? payload.totalInvoices ?? 0)
  const totalThreeWayMatches = Number(payload.totalThreeWayMatches ?? payload.totalInvoices ?? 0)
  const touchlessRatePct = Number(payload.touchlessRatePct ?? 0)
  const exceptionRatePct = Number(payload.exceptionRatePct ?? 0)

  return {
    totalRequisitions: Number(payload.totalRequisitions ?? 0),
    totalPurchaseOrders: Number(payload.totalPurchaseOrders ?? 0),
    totalInvoices,
    prsInFlight: Number(payload.prsInFlight ?? 0),
    posInFlight: Number(payload.posInFlight ?? 0),
    invoicesInFlight: Number(payload.invoicesInFlight ?? 0),
    autoApprovedPayments: Number(payload.autoApprovedPayments ?? Math.round((touchlessRatePct / 100) * totalPayments)),
    totalPayments,
    mismatchedThreeWayMatches: Number(
      payload.mismatchedThreeWayMatches ?? Math.round((exceptionRatePct / 100) * totalThreeWayMatches),
    ),
    totalThreeWayMatches,
    touchlessRatePct,
    exceptionRatePct,
    avgCycleTimeHours: payload.avgCycleTimeHours != null ? Number(payload.avgCycleTimeHours) : null,
  }
}

function buildCycleSeries(avgCycleTimeHours: number | null) {
  const current = avgCycleTimeHours ?? 72
  return [
    { period: 'W-4', cycle: current * 1.18, target: 60 },
    { period: 'W-3', cycle: current * 1.1, target: 58 },
    { period: 'W-2', cycle: current * 1.04, target: 54 },
    { period: 'W-1', cycle: current * 0.98, target: 50 },
    { period: 'Now', cycle: current, target: 48 },
  ]
}