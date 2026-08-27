import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton, UrgencyBadge, type Urgency } from '../../components/badges'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useRealtimeTable } from '../../hooks/useRealtimeTable'
import NlRequisitionChatbot from './NlRequisitionChatbot'

// ---------------------------------------------------------------------------
// Types - mirror com.chainvision.pr2.dto.RequisitionResponse /
// CreateRequisitionRequest (see Documentaion/00_PROJECT_CONTEXT.md Section 7.2 /
// 13.2). Kept local rather than shared since PR2 has no generated client yet.
// ---------------------------------------------------------------------------

export type RequisitionSource = 'SYSTEM' | 'CHATBOT' | 'MANUAL'
export type RequisitionStatus = 'CREATED' | 'SOURCED' | 'PO_RAISED'

export interface Requisition {
  id: string
  recommendationId: string | null
  skuCode: string
  dcCode: string
  quantity: number
  urgency: Urgency
  source: RequisitionSource
  rawNlInput: string | null
  status: RequisitionStatus
  createdAt: string
}

type LoadState = 'loading' | 'ok' | 'error'

const SOURCE_STYLES: Record<RequisitionSource, string> = {
  SYSTEM: 'text-mist border-line bg-panel2',
  CHATBOT: 'text-signal border-signal/30 bg-signal/10',
  MANUAL: 'text-paper border-line bg-panel2',
}

export function SourceBadge({ source }: { source: RequisitionSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${SOURCE_STYLES[source]}`}
    >
      {source}
    </span>
  )
}

const STATUS_STYLES: Record<RequisitionStatus, string> = {
  CREATED: 'text-signal border-signal/30 bg-signal/10',
  SOURCED: 'text-alert border-alert/30 bg-alert/10',
  PO_RAISED: 'text-paper border-line bg-panel2',
}

export function RequisitionStatusBadge({ status }: { status: RequisitionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export default function RequisitionsView() {
  const { skus, dcs, loading: refLoading } = useReferenceData()
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [sourceFilter, setSourceFilter] = useState<RequisitionSource | ''>('')
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | ''>('')
  const [showManualForm, setShowManualForm] = useState(false)

  const load = () => {
    setState('loading')
    const params: Record<string, string> = {}
    if (sourceFilter) params.source = sourceFilter
    if (statusFilter) params.status = statusFilter

    pr2Client
      .get<Requisition[]>('/requisitions', { params })
      .then((response) => {
        setRequisitions(
          [...response.data].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        )
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [sourceFilter, statusFilter])
  useRealtimeTable('pr2', 'purchase_requisitions', load)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Requisitions</h2>
        <p className="mt-1 text-sm text-mist">
          System-generated requisitions from P1 replenishment recommendations, alongside manual and
          chatbot-sourced ones - every requisition still needs a PO before it becomes a supplier commitment.
        </p>
      </div>

      <NlRequisitionChatbot onRequisitionCreated={load} skus={skus} dcs={dcs} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as RequisitionSource | '')}
            className="field-control"
          >
            <option value="">All sources</option>
            <option value="SYSTEM">System</option>
            <option value="CHATBOT">Chatbot</option>
            <option value="MANUAL">Manual</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequisitionStatus | '')}
            className="field-control"
          >
            <option value="">All statuses</option>
            <option value="CREATED">Created</option>
            <option value="SOURCED">Sourced</option>
            <option value="PO_RAISED">PO raised</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualForm((v) => !v)}
            className="secondary-action"
          >
            {showManualForm ? 'Close form' : '+ Manual requisition'}
          </button>
          <RefreshButton onClick={load} loading={state === 'loading'} />
        </div>
      </div>

      {showManualForm && (
        <ManualRequisitionForm
          skus={skus}
          dcs={dcs}
          refLoading={refLoading}
          onCreated={() => {
            setShowManualForm(false)
            load()
          }}
        />
      )}

      {state === 'error' ? (
        <p className="rounded-xl panel-soft p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl panel-soft" />
          ))}
        </div>
      ) : requisitions.length === 0 ? (
        <p className="rounded-xl panel-soft p-6 text-sm text-mist">
          No requisitions yet. Try the chatbot above, or add one manually.
        </p>
      ) : (
        <div className="table-shell">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-ink/40 font-mono text-[10px] uppercase tracking-wider text-mist">
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">DC</th>
                <th className="px-4 py-2.5">Qty</th>
                <th className="px-4 py-2.5">Urgency</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((req) => (
                <tr key={req.id} className="animate-rise-in border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm text-paper">{req.skuCode}</p>
                    {req.rawNlInput && (
                      <p className="mt-0.5 max-w-xs truncate text-xs italic text-mist" title={req.rawNlInput}>
                        "{req.rawNlInput}"
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mist">{req.dcCode}</td>
                  <td className="px-4 py-3 font-mono text-paper">{req.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <UrgencyBadge urgency={req.urgency} />
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge source={req.source} />
                  </td>
                  <td className="px-4 py-3">
                    <RequisitionStatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-mist/80">
                    {new Date(req.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-mist">
        Ready to source a requisition?{' '}
        <Link to="/procurement/purchase-orders" className="text-signal hover:underline">
          Generate a PO
        </Link>{' '}
        against any <span className="font-mono">CREATED</span> requisition above.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual create form - ad hoc testing, always tagged MANUAL by the backend
// (RequisitionService.createManualRequisition).
// ---------------------------------------------------------------------------

function ManualRequisitionForm({
  skus,
  dcs,
  refLoading,
  onCreated,
}: {
  skus: { skuCode: string; name: string }[]
  dcs: { dcCode: string; name: string }[]
  refLoading: boolean
  onCreated: () => void
}) {
  const [skuCode, setSkuCode] = useState('')
  const [dcCode, setDcCode] = useState('')
  const [quantity, setQuantity] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('MEDIUM')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!skuCode || !dcCode || !quantity) {
      setError('SKU, DC, and quantity are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    pr2Client
      .post('/requisitions', {
        skuCode,
        dcCode,
        quantity: Number(quantity),
        urgency,
      })
      .then(() => {
        setSkuCode('')
        setDcCode('')
        setQuantity('')
        setUrgency('MEDIUM')
        onCreated()
      })
      .catch(() => setError('Could not create the requisition. Check the values and try again.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="animate-rise-in rounded-xl panel-soft p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Manual requisition</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <select
          value={skuCode}
          onChange={(e) => setSkuCode(e.target.value)}
          disabled={refLoading}
          className="field-control"
        >
          <option value="">SKU...</option>
          {skus.map((sku) => (
            <option key={sku.skuCode} value={sku.skuCode}>
              {sku.skuCode} - {sku.name}
            </option>
          ))}
        </select>
        <select
          value={dcCode}
          onChange={(e) => setDcCode(e.target.value)}
          disabled={refLoading}
          className="field-control"
        >
          <option value="">DC...</option>
          {dcs.map((dc) => (
            <option key={dc.dcCode} value={dc.dcCode}>
              {dc.dcCode} - {dc.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="field-control"
        />
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as Urgency)}
          className="field-control"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="primary-action"
        >
          {submitting ? 'Creating...' : 'Create requisition'}
        </button>
      </div>
    </div>
  )
}

