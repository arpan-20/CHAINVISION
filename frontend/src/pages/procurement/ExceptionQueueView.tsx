import { useEffect, useState } from 'react'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton } from '../../components/badges'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeTable } from '../../hooks/useRealtimeTable'

// ---------------------------------------------------------------------------
// Mirrors com.chainvision.pr2.dto.ExceptionResponse / InvoiceResponse /
// PaymentApprovalResponse / ThreeWayMatchResponse (see
// Documentaion/00_PROJECT_CONTEXT.md Section 7.2 / 13.2). GET /api/exceptions
// lists invoices currently in EXCEPTION status with a PENDING_REVIEW payment
// approval (PaymentApprovalService.listExceptions) — the deterministic
// mismatch reason and the Gemini-generated plain-English explanation
// (MismatchExplanationService, computed once at match time) travel with each
// item. Resolving is POST /api/exceptions/{invoiceId}/resolve — a human
// decision only, never an AI one.
// ---------------------------------------------------------------------------

type InvoiceStatus = 'PENDING_MATCH' | 'MATCHED' | 'MISMATCHED' | 'APPROVED' | 'EXCEPTION'
type PaymentStatus = 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'APPROVED_MANUAL'
type MatchResult = 'MATCHED' | 'MISMATCHED'
type Decision = 'APPROVE' | 'REJECT'

interface InvoiceResponse {
  id: string
  poId: string | null
  invoiceNumber: string
  vendorNameOcr: string
  quantityOcr: number | null
  unitPriceOcr: number | null
  totalOcr: number | null
  status: InvoiceStatus
  createdAt: string
}

interface PaymentApprovalResponse {
  id: string
  invoiceId: string
  status: PaymentStatus
  approvedBy: string | null
  approvedAt: string | null
}

interface ThreeWayMatchResponse {
  id: string
  invoiceId: string
  poId: string
  grnId: string
  qtyMatch: boolean
  priceMatch: boolean
  result: MatchResult
  mismatchReason: string | null
  aiExplanation: string | null
  matchedAt: string
}

interface ExceptionItem {
  invoice: InvoiceResponse
  paymentApproval: PaymentApprovalResponse
  latestMatch: ThreeWayMatchResponse | null
  aiExplanation: string | null
}

type LoadState = 'loading' | 'ok' | 'error'

const currency = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)

export default function ExceptionQueueView() {
  const { user } = useAuth()
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const load = () => {
    setState('loading')
    pr2Client
      .get<ExceptionItem[]>('/exceptions')
      .then((res) => {
        setExceptions(res.data)
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])
  useRealtimeTable('pr2', 'payment_approvals', load)

  const resolve = (invoiceId: string, decision: Decision) => {
    setResolvingId(invoiceId)
    setResolveError(null)
    pr2Client
      .post(`/exceptions/${invoiceId}/resolve`, {
        decision,
        approvedBy: user?.name ?? 'Procurement Officer',
      })
      .then(() => {
        setExceptions((prev) => prev.filter((item) => item.invoice.id !== invoiceId))
      })
      .catch(() => setResolveError('Could not resolve this exception. Refresh and try again.'))
      .finally(() => setResolvingId(null))
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Exception queue</h2>
          <p className="mt-1 text-sm text-mist">
            Invoices where the deterministic 3-way match failed — each carries a Gemini-generated
            plain-English explanation of the mismatch for a Procurement Officer to review.
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      {resolveError && <p className="text-xs text-critical">{resolveError}</p>}

      {state === 'error' ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-line bg-panel" />
          ))}
        </div>
      ) : exceptions.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-mist">
          No exceptions in the queue — every invoice that's run through 3-way match so far has matched
          or been resolved.
        </p>
      ) : (
        <div className="space-y-4">
          {exceptions.map(({ invoice, latestMatch, aiExplanation }) => (
            <div key={invoice.id} className="animate-rise-in rounded-xl border border-critical/30 bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold text-paper">{invoice.invoiceNumber}</p>
                  <p className="mt-0.5 font-mono text-xs text-mist">
                    {invoice.vendorNameOcr} · qty {invoice.quantityOcr?.toLocaleString() ?? '—'} · unit{' '}
                    {currency(invoice.unitPriceOcr)} · total {currency(invoice.totalOcr)}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-critical/40 bg-critical/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-critical">
                  Exception
                </span>
              </div>

              {latestMatch?.mismatchReason && (
                <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-mist">
                    Deterministic mismatch reason
                  </p>
                  <p className="mt-1 text-sm text-paper/90">{latestMatch.mismatchReason}</p>
                </div>
              )}

              {aiExplanation && (
                <div className="mt-3 rounded-lg border border-signal/30 bg-signal/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-signal">
                    Gemini explanation
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-paper">{aiExplanation}</p>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => resolve(invoice.id, 'REJECT')}
                  disabled={resolvingId === invoice.id}
                  className="rounded-lg border border-critical/40 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-critical transition-colors hover:bg-critical/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => resolve(invoice.id, 'APPROVE')}
                  disabled={resolvingId === invoice.id}
                  className="rounded-lg bg-signal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resolvingId === invoice.id ? 'Resolving…' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
