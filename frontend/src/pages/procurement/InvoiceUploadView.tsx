import { useEffect, useMemo, useState, type DragEvent } from 'react'

import { pr2Client } from '../../api/pr2Client'
import { RefreshButton } from '../../components/badges'

// ---------------------------------------------------------------------------
// Mirrors com.chainvision.pr2.dto.InvoiceResponse / ThreeWayMatchResponse /
// PurchaseOrderResponse (see Documentaion/00_PROJECT_CONTEXT.md Section 7.2 /
// 13.2). Upload is POST /api/invoices/upload (multipart: file, poId), which
// runs Gemini-based OCR/structuring server-side (InvoiceStructuringService)
// — this view only ever sends the raw file + chosen PO, never any OCR logic.
// Matching is POST /api/invoices/{id}/match, which is a purely deterministic
// PO vs GRN vs Invoice comparison (ThreeWayMatchEngine) — the AI touchpoint
// there is limited to phrasing the mismatch reason on failure, already done
// server-side.
// ---------------------------------------------------------------------------

type InvoiceStatus = 'PENDING_MATCH' | 'MATCHED' | 'MISMATCHED' | 'APPROVED' | 'EXCEPTION'
type PurchaseOrderStatus = 'ISSUED' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED'
type MatchResult = 'MATCHED' | 'MISMATCHED'

interface InvoiceResponse {
  id: string
  poId: string | null
  invoiceNumber: string
  vendorNameOcr: string
  quantityOcr: number | null
  unitPriceOcr: number | null
  totalOcr: number | null
  rawOcrJson: string | null
  uploadedFileRef: string | null
  status: InvoiceStatus
  createdAt: string
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
}

interface Supplier {
  id: string
  name: string
}

type LoadState = 'loading' | 'ok' | 'error'

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  PENDING_MATCH: 'text-mist border-line bg-panel2',
  MATCHED: 'text-signal border-signal/30 bg-signal/10',
  MISMATCHED: 'text-alert border-alert/30 bg-alert/10',
  APPROVED: 'text-signal border-signal/30 bg-signal/10',
  EXCEPTION: 'text-critical border-critical/40 bg-critical/10',
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${INVOICE_STATUS_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

const currency = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)

export default function InvoiceUploadView() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([])
  const [state, setState] = useState<LoadState>('loading')

  const [selectedPoId, setSelectedPoId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [matchByInvoiceId, setMatchByInvoiceId] = useState<Record<string, ThreeWayMatchResponse>>({})
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  const supplierById = new Map(suppliers.map((s) => [s.id, s]))

  // Only POs with at least one recorded goods receipt are offered — the 3-way
  // match engine requires a GRN to exist (MatchingService.runMatch throws
  // otherwise), so this keeps the upload flow demo-safe end to end.
  const receivedPoIds = useMemo(() => new Set(goodsReceipts.map((g) => g.poId)), [goodsReceipts])
  const eligiblePos = useMemo(
    () => purchaseOrders.filter((po) => receivedPoIds.has(po.id)),
    [purchaseOrders, receivedPoIds],
  )

  const activeInvoice = invoices.find((i) => i.id === activeInvoiceId) ?? null
  const activeMatch = activeInvoiceId ? matchByInvoiceId[activeInvoiceId] : undefined

  const load = () => {
    setState('loading')
    Promise.all([
      pr2Client.get<PurchaseOrder[]>('/purchase-orders'),
      pr2Client.get<GoodsReceipt[]>('/goods-receipts'),
      pr2Client.get<Supplier[]>('/suppliers'),
      pr2Client.get<InvoiceResponse[]>('/invoices'),
    ])
      .then(([poRes, grnRes, supplierRes, invRes]) => {
        setPurchaseOrders(poRes.data)
        setGoodsReceipts(grnRes.data)
        setSuppliers(supplierRes.data)
        setInvoices(
          [...invRes.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        )
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  const upload = () => {
    if (!file) {
      setUploadError('Choose an invoice file first.')
      return
    }
    if (!selectedPoId) {
      setUploadError('Select the purchase order this invoice is for.')
      return
    }
    setUploading(true)
    setUploadError(null)
    setMatchError(null)

    const form = new FormData()
    form.append('file', file)
    form.append('poId', selectedPoId)

    pr2Client
      .post<InvoiceResponse>('/invoices/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => {
        setInvoices((prev) => [res.data, ...prev])
        setActiveInvoiceId(res.data.id)
        setFile(null)
      })
      .catch(() => setUploadError('Upload failed — check the file and PO selection, then try again.'))
      .finally(() => setUploading(false))
  }

  const runMatch = (invoice: InvoiceResponse) => {
    setMatching(true)
    setMatchError(null)
    pr2Client
      .post<ThreeWayMatchResponse>(`/invoices/${invoice.id}/match`, {
        poId: invoice.poId ?? selectedPoId,
      })
      .then((res) => {
        setMatchByInvoiceId((prev) => ({ ...prev, [invoice.id]: res.data }))
        setInvoices((prev) =>
          prev.map((i) => (i.id === invoice.id ? { ...i, status: res.data.result === 'MATCHED' ? 'MATCHED' : 'MISMATCHED' } : i)),
        )
      })
      .catch((err) => {
        const detail = err?.response?.data?.message
        setMatchError(detail ?? 'Could not run the 3-way match. Confirm a goods receipt exists for this PO.')
      })
      .finally(() => setMatching(false))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Invoice upload</h2>
          <p className="mt-1 text-sm text-mist">
            Upload a supplier invoice for a received PO — Gemini extracts the structured fields, then a
            deterministic 3-way match compares PO, GRN, and invoice.
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      {state === 'error' ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the PR2 API. Check the backend connection and refresh.
        </p>
      ) : (
        <>
          {/* Upload panel */}
          <div className="animate-rise-in rounded-xl border border-line bg-panel p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.2fr]">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
                  Purchase order (must have a goods receipt)
                </span>
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  disabled={uploading || state === 'loading'}
                  className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
                >
                  <option value="">Select a PO…</option>
                  {eligiblePos.map((po) => (
                    <option key={po.id} value={po.id}>
                      PO {po.id.slice(0, 8)} · {supplierById.get(po.supplierId)?.name ?? po.supplierId} ·{' '}
                      {po.quantity.toLocaleString()} units
                    </option>
                  ))}
                </select>
                {eligiblePos.length === 0 && state === 'ok' && (
                  <p className="mt-1.5 text-xs text-mist">
                    No POs have a recorded goods receipt yet — record one on the Goods Receipt tab first.
                  </p>
                )}
              </label>

              <label
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
                  dragOver ? 'border-signal/60 bg-signal/5' : 'border-line bg-panel2'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                <span className="font-mono text-[10px] uppercase tracking-wider text-mist">
                  Drag & drop or click to choose
                </span>
                <span className="mt-1 truncate text-sm text-paper">{file ? file.name : 'No file selected'}</span>
              </label>
            </div>

            {uploadError && <p className="mt-3 text-xs text-critical">{uploadError}</p>}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={upload}
                disabled={uploading}
                className="rounded-lg bg-signal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload invoice'}
              </button>
            </div>
          </div>

          {/* Active invoice detail — extracted fields + match action */}
          {activeInvoice && (
            <div className="animate-rise-in rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-mist">
                    Gemini-extracted fields
                  </p>
                  <p className="mt-0.5 font-display text-base font-semibold text-paper">
                    {activeInvoice.invoiceNumber}
                  </p>
                </div>
                <InvoiceStatusBadge status={activeInvoice.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Vendor" value={activeInvoice.vendorNameOcr} />
                <Field label="Quantity" value={activeInvoice.quantityOcr?.toLocaleString() ?? '—'} />
                <Field label="Unit price" value={currency(activeInvoice.unitPriceOcr)} />
                <Field label="Total" value={currency(activeInvoice.totalOcr)} />
              </div>

              {activeInvoice.status === 'PENDING_MATCH' ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => runMatch(activeInvoice)}
                    disabled={matching}
                    className="rounded-lg bg-signal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {matching ? 'Matching…' : 'Run 3-way match'}
                  </button>
                </div>
              ) : null}

              {matchError && <p className="mt-3 text-xs text-critical">{matchError}</p>}

              {activeMatch && (
                <div
                  className={`mt-4 rounded-lg border p-4 ${
                    activeMatch.result === 'MATCHED'
                      ? 'border-signal/30 bg-signal/10'
                      : 'border-alert/30 bg-alert/10'
                  }`}
                >
                  <p
                    className={`font-mono text-xs font-semibold uppercase tracking-wider ${
                      activeMatch.result === 'MATCHED' ? 'text-signal' : 'text-alert'
                    }`}
                  >
                    {activeMatch.result}
                  </p>
                  {activeMatch.mismatchReason && (
                    <p className="mt-1.5 text-sm text-paper/90">{activeMatch.mismatchReason}</p>
                  )}
                  {activeMatch.aiExplanation && (
                    <p className="mt-1.5 text-sm italic text-mist">"{activeMatch.aiExplanation}"</p>
                  )}
                  {activeMatch.result === 'MATCHED' && (
                    <p className="mt-1.5 text-sm text-paper/90">Payment auto-approved — touchless, no human step needed.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recent invoices */}
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Recent invoices</p>
            {state === 'loading' ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-panel" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <p className="rounded-xl border border-line bg-panel p-6 text-sm text-mist">
                No invoices uploaded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setActiveInvoiceId(inv.id)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${
                      inv.id === activeInvoiceId ? 'border-signal/40 bg-panel2' : 'border-line bg-panel hover:border-signal/20'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-paper">{inv.invoiceNumber}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-mist">
                        {inv.vendorNameOcr} · {currency(inv.totalOcr)}
                      </p>
                    </div>
                    <InvoiceStatusBadge status={inv.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="mt-0.5 truncate text-sm text-paper">{value}</p>
    </div>
  )
}