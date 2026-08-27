import { useEffect, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton } from '../../components/badges'

// ---------------------------------------------------------------------------
// Primary source: GET /api/analytics/p2p-summary, backed by
// com.chainvision.pr2.service.AnalyticsService.summarize() (see
// Documentaion/00_PROJECT_CONTEXT.md Section 13.2). That endpoint exists in
// this codebase as of P19.3, so it is used directly — no substitution needed
// in the common case. Its exact formulas (mirrored in the comments below):
//   touchlessRatePct  = 100 * count(payment_approvals.status == AUTO_APPROVED)
//                        / count(payment_approvals)
//   exceptionRatePct  = 100 * count(three_way_matches.result == MISMATCHED)
//                        / count(three_way_matches)
//   avgCycleTimeHours = mean(payment.approvedAt - requisition.createdAt) over
//                        payments that resolved to an approval, hours
//
// Fallback: if that endpoint is ever missing/unreachable (e.g. an older
// backend build), this view computes an equivalent client-side aggregate
// from GET /api/invoices + GET /api/exceptions as an acceptable hackathon
// substitute, flagged in the UI with a "computed client-side" note. Fallback
// formula: touchless % = (processed invoices - open exceptions) / processed
// invoices * 100, where "processed" = invoices no longer PENDING_MATCH.
// ---------------------------------------------------------------------------

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
        // Endpoint missing or unreachable — fall back to a client-side
        // aggregate over invoices + exceptions, per this view's constraints.
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">P2P analytics</h2>
          <p className="mt-1 text-sm text-mist">
            Touchless-processing rate, exception rate, and cycle time across the procure-to-pay flow.
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      {isClientComputed && (
        <p className="rounded-lg border border-alert/30 bg-alert/10 px-4 py-2.5 font-mono text-xs text-alert">
          Backend analytics endpoint unavailable — figures below are computed client-side from
          /api/invoices + /api/exceptions as a substitute (see code comment for the exact formula).
        </p>
      )}

      {state === 'error' ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' || !summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-panel" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Auto-approved payments"
              value={summary.autoApprovedPayments.toLocaleString()}
              hint={`${summary.totalPayments.toLocaleString()} total payments`}
            />
            <StatCard
              label="Invoices processed"
              value={summary.totalInvoices.toLocaleString()}
              hint={`${summary.invoicesInFlight.toLocaleString()} in flight`}
            />
            <StatCard
              label="Mismatched 3-way matches"
              value={summary.mismatchedThreeWayMatches.toLocaleString()}
              hint={`${summary.totalThreeWayMatches.toLocaleString()} total 3-way matches`}
            />
            <StatCard
              label="Avg. cycle time"
              value={summary.avgCycleTimeHours != null ? `${summary.avgCycleTimeHours.toFixed(1)}h` : '—'}
              hint="Requisition created → payment approved"
            />
          </div>

          {!isClientComputed && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Requisitions" value={summary.totalRequisitions.toLocaleString()} hint={`${summary.prsInFlight} in flight`} />
              <StatCard label="Purchase orders" value={summary.totalPurchaseOrders.toLocaleString()} hint={`${summary.posInFlight} in flight`} />
              <StatCard label="Invoices" value={summary.totalInvoices.toLocaleString()} hint={`${summary.invoicesInFlight} in flight`} />
            </div>
          )}

          <PaymentMatchPieChart
            autoApprovedPayments={summary.autoApprovedPayments}
            mismatchedThreeWayMatches={summary.mismatchedThreeWayMatches}
          />
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="animate-rise-in rounded-xl border border-line bg-panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-paper">{value}</p>
      <p className="mt-1 text-xs text-mist">{hint}</p>
    </div>
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

function PaymentMatchPieChart({
  autoApprovedPayments,
  mismatchedThreeWayMatches,
}: {
  autoApprovedPayments: number
  mismatchedThreeWayMatches: number
}) {
  const data = [
    { name: 'Auto-approved payments', value: autoApprovedPayments, color: '#47d7ac' },
    { name: 'Mismatched 3-way matches', value: mismatchedThreeWayMatches, color: '#fb7185' },
  ]

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight text-paper">Payment &amp; match outcomes</h3>
        <p className="mt-1 text-sm text-mist">Auto-approved payments compared with 3-way matches that mismatched.</p>
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} paddingAngle={3}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Count']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
