import { useEffect, useState } from 'react'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton } from '../../components/badges'

// ---------------------------------------------------------------------------
// Mirrors com.chainvision.pr2.dto.PurchaseOrderResponse / GoodsReceiptResponse
// / CreateGoodsReceiptRequest (see Documentaion/00_PROJECT_CONTEXT.md Section
// 7.2 / 13.2). GoodsReceiptService.recordReceipt is a "simulated one-click
// receipt" — no AI or IoT/CV integration here, matching the code comment.
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

interface GoodsReceipt {
  id: string
  poId: string
  receivedQty: number
  batchNo: string | null
  expiryDate: string | null
  receivedAt: string
}

interface Supplier {
  id: string
  name: string
}

type LoadState = 'loading' | 'ok' | 'error'

// Only ISSUED / PARTIALLY_RECEIVED POs are shown here per this view's scope
// (P19.2 instructions). GoodsReceiptService also accepts ACKNOWLEDGED POs —
// that status simply doesn't appear in this demo's PO generation flow yet.
const OPEN_STATUSES: PurchaseOrderStatus[] = ['ISSUED', 'PARTIALLY_RECEIVED']

export default function GoodsReceiptView() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [openPoId, setOpenPoId] = useState<string | null>(null)

  const supplierById = new Map(suppliers.map((s) => [s.id, s]))
  const receivedByPo = new Map<string, number>()
  receipts.forEach((r) => receivedByPo.set(r.poId, (receivedByPo.get(r.poId) ?? 0) + r.receivedQty))

  const load = () => {
    setState('loading')
    Promise.all([
      pr2Client.get<PurchaseOrder[]>('/purchase-orders'),
      pr2Client.get<GoodsReceipt[]>('/goods-receipts'),
      pr2Client.get<Supplier[]>('/suppliers'),
    ])
      .then(([poRes, grnRes, supplierRes]) => {
        setPurchaseOrders(poRes.data.filter((po) => OPEN_STATUSES.includes(po.status)))
        setReceipts(grnRes.data)
        setSuppliers(supplierRes.data)
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Goods receipt</h2>
          <p className="mt-1 text-sm text-mist">
            POs open for receiving — confirm quantity, batch, and expiry at the dock. Partial receipts keep
            the PO open until the full quantity has arrived.
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      {state === 'error' ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-panel" />
          ))}
        </div>
      ) : purchaseOrders.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-mist">
          No POs awaiting receipt. Generate one from the Purchase Orders tab first.
        </p>
      ) : (
        <div className="space-y-3">
          {purchaseOrders.map((po) => (
            <div key={po.id} className="animate-rise-in rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold text-paper">
                    {supplierById.get(po.supplierId)?.name ?? po.supplierId}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-mist">
                    PO {po.id.slice(0, 8)} · ordered {po.quantity.toLocaleString()} · received{' '}
                    {(receivedByPo.get(po.id) ?? 0).toLocaleString()}
                  </p>
                </div>
                <PoStatusBadge status={po.status} />
              </div>

              {openPoId === po.id ? (
                <ReceiptForm
                  po={po}
                  alreadyReceived={receivedByPo.get(po.id) ?? 0}
                  onDone={() => {
                    setOpenPoId(null)
                    load()
                  }}
                  onCancel={() => setOpenPoId(null)}
                />
              ) : (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenPoId(po.id)}
                    className="rounded-lg bg-signal px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90"
                  >
                    Mark as received
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const styles: Record<PurchaseOrderStatus, string> = {
    ISSUED: 'text-signal border-signal/30 bg-signal/10',
    ACKNOWLEDGED: 'text-signal border-signal/30 bg-signal/10',
    PARTIALLY_RECEIVED: 'text-alert border-alert/30 bg-alert/10',
    RECEIVED: 'text-paper border-line bg-panel2',
    CLOSED: 'text-mist border-line bg-panel2',
  }
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function ReceiptForm({
  po,
  alreadyReceived,
  onDone,
  onCancel,
}: {
  po: PurchaseOrder
  alreadyReceived: number
  onDone: () => void
  onCancel: () => void
}) {
  const remaining = Math.max(po.quantity - alreadyReceived, 0)
  const [receivedQty, setReceivedQty] = useState(String(remaining))
  const [batchNo, setBatchNo] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const qty = Number(receivedQty)
    if (!qty || qty <= 0) {
      setError('Enter a received quantity greater than zero.')
      return
    }
    setSubmitting(true)
    setError(null)
    pr2Client
      .post('/goods-receipts', {
        poId: po.id,
        receivedQty: qty,
        batchNo: batchNo || undefined,
        expiryDate: expiryDate || undefined,
      })
      .then(() => onDone())
      .catch((requestError: unknown) => {
        // Preserve the backend's actionable validation/state message instead
        // of masking auth, already-received, or invalid-PO errors.
        const message = (
          requestError as { response?: { data?: { error?: { message?: string } } } }
        ).response?.data?.error?.message
        setError(message ?? 'Could not record the receipt. Check the quantity and try again.')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-ink/50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
            Received qty (of {remaining.toLocaleString()} remaining)
          </span>
          <input
            type="number"
            min={1}
            value={receivedQty}
            onChange={(e) => setReceivedQty(e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
            Batch no. (optional)
          </span>
          <input
            type="text"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
            Expiry date (optional)
          </span>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-mist transition-colors hover:text-paper"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-lg bg-signal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Recording…' : 'Confirm receipt'}
        </button>
      </div>
    </div>
  )
}
