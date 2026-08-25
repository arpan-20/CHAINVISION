import { useEffect, useState } from 'react'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton } from '../../components/badges'
import { SourceBadge, type Requisition } from './RequisitionsView'

// ---------------------------------------------------------------------------
// Mirrors com.chainvision.pr2.dto.PurchaseOrderResponse / SupplierResponse
// (see Documentaion/00_PROJECT_CONTEXT.md Section 7.2 / 13.2).
// ---------------------------------------------------------------------------

type PurchaseOrderStatus = 'ISSUED' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED'

interface PurchaseOrder {
  id: string
  requisitionId: string
  supplierId: string
  quantity: number
  unitPrice: number | null
  totalAmount: number | null
  status: PurchaseOrderStatus
  createdAt: string
}

interface Supplier {
  id: string
  name: string
  priceIndex: number
  avgLeadTimeDays: number
  otdScore: number
  qualityScore: number
  capacityUnits: number
}

type LoadState = 'loading' | 'ok' | 'error'

const PO_STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  ISSUED: 'text-signal border-signal/30 bg-signal/10',
  ACKNOWLEDGED: 'text-signal border-signal/30 bg-signal/10',
  PARTIALLY_RECEIVED: 'text-alert border-alert/30 bg-alert/10',
  RECEIVED: 'text-paper border-line bg-panel2',
  CLOSED: 'text-mist border-line bg-panel2',
}

function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${PO_STATUS_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

const currency = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)

export default function PurchaseOrdersView() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const supplierById = new Map(suppliers.map((s) => [s.id, s]))
  const requisitionById = new Map(requisitions.map((r) => [r.id, r]))

  const load = () => {
    setState('loading')
    Promise.all([
      pr2Client.get<PurchaseOrder[]>('/purchase-orders'),
      pr2Client.get<Requisition[]>('/requisitions', { params: { status: 'CREATED' } }),
      pr2Client.get<Supplier[]>('/suppliers'),
    ])
      .then(([poRes, reqRes, supplierRes]) => {
        setPurchaseOrders(
          [...poRes.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        )
        setRequisitions(reqRes.data)
        setSuppliers(supplierRes.data)
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  const generatePo = (requisitionId: string) => {
    setGeneratingId(requisitionId)
    setGenError(null)
    pr2Client
      .post(`/purchase-orders/${requisitionId}`)
      .then(() => load())
      .catch(() => setGenError('Could not generate a PO for that requisition — check supplier data and retry.'))
      .finally(() => setGeneratingId(null))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Purchase orders</h2>
          <p className="mt-1 text-sm text-mist">
            POs issued to suppliers once a requisition is sourced — supplier chosen by deterministic
            price/lead-time/OTD/quality scoring.
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      {state === 'error' && (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      )}

      {/* Requisitions ready to be sourced */}
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
          Requisitions awaiting a PO
        </p>
        {genError && <p className="mb-2 text-xs text-critical">{genError}</p>}
        {state === 'loading' ? (
          <div className="h-16 animate-pulse rounded-xl border border-line bg-panel" />
        ) : requisitions.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-5 text-sm text-mist">
            No <span className="font-mono">CREATED</span> requisitions right now — create one from the
            Requisitions tab first.
          </p>
        ) : (
          <div className="space-y-2">
            {requisitions.map((req) => (
              <div
                key={req.id}
                className="animate-rise-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm text-paper">
                    {req.skuCode} <span className="text-mist">→</span> {req.dcCode}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-mist">
                    Qty {req.quantity.toLocaleString()} <SourceBadge source={req.source} />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => generatePo(req.id)}
                  disabled={generatingId === req.id}
                  className="rounded-lg bg-signal px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingId === req.id ? 'Generating…' : 'Generate PO'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PO list */}
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">All purchase orders</p>
        {state === 'loading' ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-panel" />
            ))}
          </div>
        ) : purchaseOrders.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-6 text-sm text-mist">
            No purchase orders yet. Generate one from a requisition above.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-ink/40 font-mono text-[10px] uppercase tracking-wider text-mist">
                  <th className="px-4 py-2.5">Requisition</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5">Qty</th>
                  <th className="px-4 py-2.5">Unit price</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => {
                  const req = requisitionById.get(po.requisitionId)
                  const supplier = supplierById.get(po.supplierId)
                  return (
                    <tr key={po.id} className="animate-rise-in border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm text-paper">
                          {req ? `${req.skuCode} → ${req.dcCode}` : po.requisitionId}
                        </p>
                        {req && (
                          <p className="mt-0.5 text-xs text-mist">Requisition qty {req.quantity.toLocaleString()}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-paper">{supplier?.name ?? po.supplierId}</td>
                      <td className="px-4 py-3 font-mono text-paper">{po.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-paper">{currency(po.unitPrice)}</td>
                      <td className="px-4 py-3 font-mono text-signal">{currency(po.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <PoStatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-mist/80">
                        {new Date(po.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
