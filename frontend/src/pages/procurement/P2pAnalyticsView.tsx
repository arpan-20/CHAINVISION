import { useEffect, useState } from 'react'

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
        setSummary(res.data)
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

            setSummary({
              totalRequisitions: 0,
              totalPurchaseOrders: 0,
              totalInvoices: invoices.length,
              prsInFlight: 0,
              posInFlight: 0,
              invoicesInFlight: invoices.filter((i) => i.status !== 'APPROVED').length,
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
              label="Touchless processing"
              value={`${summary.touchlessRatePct.toFixed(1)}%`}
              hint="Auto-approved payments / total payments"
            />
            <StatCard
              label="Invoices processed"
              value={summary.totalInvoices.toLocaleString()}
              hint={`${summary.invoicesInFlight.toLocaleString()} in flight`}
            />
            <StatCard
              label="Exception rate"
              value={`${summary.exceptionRatePct.toFixed(1)}%`}
              hint="3-way matches that mismatched"
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