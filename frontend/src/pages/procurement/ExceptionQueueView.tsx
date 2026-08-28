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

  const totalDisputed = exceptions.reduce((sum, e) => sum + (e.invoice.totalOcr ?? 0), 0)
  const totalQuantityMismatch = exceptions.filter((e) => e.latestMatch && !e.latestMatch.qtyMatch).length
  const totalPriceMismatch = exceptions.filter((e) => e.latestMatch && !e.latestMatch.priceMatch).length

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

      {exceptions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-critical/30 bg-critical/5 p-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-critical/80">Disputed value</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-critical">
              {currency(totalDisputed)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Qty mismatches</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-paper">
              {totalQuantityMismatch}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">Price mismatches</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-paper">
              {totalPriceMismatch}
            </p>
          </div>
        </div>
      )}

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
          {exceptions.map(({ invoice, latestMatch, aiExplanation }) => {
            const qtyMismatch = latestMatch && !latestMatch.qtyMatch
            const priceMismatch = latestMatch && !latestMatch.priceMatch
            return (
              <div key={invoice.id} className="animate-rise-in rounded-xl border border-critical/30 bg-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-paper">{invoice.invoiceNumber}</p>
                    <p className="mt-0.5 font-mono text-xs text-mist">
                      {invoice.vendorNameOcr} · qty {invoice.quantityOcr?.toLocaleString() ?? '—'} · unit{' '}
                      {currency(invoice.unitPriceOcr)} · total {currency(invoice.totalOcr)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {qtyMismatch && (
                      <span className="inline-flex items-center rounded-full border border-alert/30 bg-alert/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-alert">
                        Qty Δ
                      </span>
                    )}
                    {priceMismatch && (
                      <span className="inline-flex items-center rounded-full border border-critical/40 bg-critical/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-critical">
                        Price Δ
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-critical/40 bg-critical/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-critical">
                      Exception
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {latestMatch?.mismatchReason && (
                    <div className="rounded-lg border border-alert/30 bg-alert/5 p-3">
                      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-alert">
                        Deterministic mismatch
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-paper/90">{latestMatch.mismatchReason}</p>
                      <p className="mt-2 font-mono text-[10px] text-mist/60">
                        Rules: qty tolerance 2%, price tolerance 1%
                      </p>
                    </div>
                  )}

                  {aiExplanation && (
                    <div className="rounded-lg border border-signal/30 bg-signal/10 p-3">
                      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-signal">
                        Gemini explanation
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-paper">{aiExplanation}</p>
                    </div>
                  )}

                  {!aiExplanation && !latestMatch?.mismatchReason && (
                    <div className="rounded-lg border border-line bg-ink/40 p-3 text-xs text-mist">
                      Awaiting AI analysis — usually completes within 2 seconds.
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-line/70 bg-ink/30 px-3 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-mist">Recommended next steps</p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-paper/80">
                    {priceMismatch && (
                      <li className="flex items-start gap-1.5">
                        <span className="text-signal">·</span>
                        <span>Request credit note from vendor for the disputed difference</span>
                      </li>
                    )}
                    {qtyMismatch && (
                      <li className="flex items-start gap-1.5">
                        <span className="text-signal">·</span>
                        <span>Verify goods receipt — initiate GRN shortage debit if applicable</span>
                      </li>
                    )}
                    <li className="flex items-start gap-1.5">
                      <span className="text-mist">·</span>
                      <span>Flag in supplier scorecard for repeat mismatches</span>
                    </li>
                  </ul>
                </div>

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
            )
          })}
        </div>
      )}
    </div>
  )
}
