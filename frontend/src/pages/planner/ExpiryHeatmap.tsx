import { useEffect, useMemo, useState } from 'react'

import { p1Client } from '../../api/p1Client'
import { RefreshButton, RiskBadge, RISK_CELL_STYLES, type ExpiryRisk } from '../../components/badges'
import { useReferenceData } from '../../hooks/useReferenceData'
import { formatINR } from '../../lib/format'

interface Batch {
  id: string
  skuId: string
  dcId: string
  batchNo: string
  quantity: number
  expiryDate: string
  receivedDate: string
  daysUntilExpiry: number
  expiryRisk: ExpiryRisk
}

type LoadState = 'loading' | 'ok' | 'error'

const RISK_RANK: Record<ExpiryRisk, number> = { EXPIRED: 3, CRITICAL: 2, WARNING: 1, OK: 0 }

export default function ExpiryHeatmap() {
  const { skus, dcs, skuById, dcById } = useReferenceData()
  const [batches, setBatches] = useState<Batch[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [selectedCell, setSelectedCell] = useState<{ skuId: string; dcId: string } | null>(null)

  const load = () => {
    setState('loading')
    p1Client
      .get<{ data: { batches: Batch[] } }>('/inventory', { params: { detail: 'batches' } })
      .then((response) => {
        setBatches(response.data.data.batches)
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  // Cell = worst-case risk among a SKU × DC's batches, plus the count
  // and the soonest expiry, so a glance shows what needs attention.
  const grid = useMemo(() => {
    const cells = new Map<
      string,
      { worst: ExpiryRisk; count: number; soonestDays: number; valueAtRisk: number }
    >()

    for (const batch of batches) {
      const key = `${batch.skuId}:${batch.dcId}`
      const existing = cells.get(key)
      const sku = skuById.get(batch.skuId)
      const batchValue = (sku?.unitCost ?? 0) * batch.quantity
      if (!existing || RISK_RANK[batch.expiryRisk] > RISK_RANK[existing.worst]) {
        cells.set(key, {
          worst: batch.expiryRisk,
          count: (existing?.count ?? 0) + 1,
          soonestDays: Math.min(existing?.soonestDays ?? Infinity, batch.daysUntilExpiry),
          valueAtRisk: (existing?.valueAtRisk ?? 0) + batchValue,
        })
      } else {
        cells.set(key, {
          ...existing,
          count: existing.count + 1,
          soonestDays: Math.min(existing.soonestDays, batch.daysUntilExpiry),
          valueAtRisk: existing.valueAtRisk + batchValue,
        })
      }
    }
    return cells
  }, [batches, skuById])

  const rowSkus = useMemo(() => {
    const activeSkuIds = new Set(batches.map((b) => b.skuId))
    return skus.filter((sku) => activeSkuIds.has(sku.id))
  }, [skus, batches])

  const colDcs = useMemo(() => {
    const activeDcIds = new Set(batches.map((b) => b.dcId))
    return dcs.filter((dc) => activeDcIds.has(dc.id))
  }, [dcs, batches])

  // FEFO stack for the selected cell — sorted by soonest expiry first (First-Expiry-First-Out)
  const fefoStack = useMemo(() => {
    if (!selectedCell) return []
    return batches
      .filter((b) => b.skuId === selectedCell.skuId && b.dcId === selectedCell.dcId)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  }, [batches, selectedCell])

  const mostUrgent = useMemo(
    () =>
      [...batches]
        .filter((b) => b.expiryRisk === 'CRITICAL' || b.expiryRisk === 'EXPIRED')
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
        .slice(0, 8),
    [batches],
  )

  // Total ₹ at risk across all CRITICAL/EXPIRED batches (the headline number)
  const totalValueAtRisk = useMemo(() => {
    return mostUrgent.reduce((sum, b) => {
      const sku = skuById.get(b.skuId)
      return sum + (sku?.unitCost ?? 0) * b.quantity
    }, 0)
  }, [mostUrgent, skuById])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Expiry risk heatmap</h2>
          <p className="mt-1 text-sm text-mist">Worst-case batch risk per SKU × distribution center.</p>
        </div>
        <div className="flex items-center gap-4">
          <Legend />
          <RefreshButton onClick={load} loading={state === 'loading'} />
        </div>
      </div>

      {totalValueAtRisk > 0 && (
        <div className="rounded-xl border border-critical/40 bg-critical/5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-critical/80">Write-off exposure</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-critical">
                {formatINR(totalValueAtRisk, { compact: false, decimals: 0 })}
              </p>
              <p className="mt-0.5 text-xs text-mist">
                Across <span className="text-paper">{mostUrgent.length}</span> critical/expired batch{mostUrgent.length === 1 ? '' : 'es'} — issue POs or transfer before expiry
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Sooneest expiry</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-paper">
                {mostUrgent[0]?.daysUntilExpiry ?? 0}d
              </p>
              <p className="mt-0.5 text-xs text-mist">{mostUrgent[0] ? skuById.get(mostUrgent[0].skuId)?.skuCode : '—'}</p>
            </div>
          </div>
        </div>
      )}

      {state === 'error' ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-critical">
          Couldn't reach the P1 API. Check the backend connection and refresh.
        </p>
      ) : state === 'loading' ? (
        <div className="h-64 animate-pulse rounded-xl border border-line bg-panel" />
      ) : rowSkus.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-sm text-mist">No batches on hand yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel p-4">
          <table className="w-full border-separate border-spacing-1.5 text-left text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-mist">SKU \ DC</th>
                {colDcs.map((dc) => (
                  <th key={dc.id} className="px-2 py-1 text-center font-mono text-[10px] uppercase tracking-wider text-mist">
                    {dc.dcCode}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowSkus.map((sku) => (
                <tr key={sku.id}>
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-[11px] text-paper">{sku.skuCode}</td>
                  {colDcs.map((dc) => {
                    const cell = grid.get(`${sku.id}:${dc.id}`)
                    return (
                      <td key={dc.id} className="p-0">
                        {cell ? (
                          <button
                            type="button"
                            onClick={() => setSelectedCell({ skuId: sku.id, dcId: dc.id })}
                            title={`${cell.count} batch(es) · soonest expiry in ${cell.soonestDays}d · click for FEFO stack`}
                            className={`flex h-14 w-20 flex-col items-center justify-center rounded-lg border font-mono transition-all hover:scale-[1.06] hover:ring-1 hover:ring-signal/60 cursor-pointer ${RISK_CELL_STYLES[cell.worst]}`}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wide">{cell.worst}</span>
                            <span className="text-[10px] opacity-80">{cell.soonestDays}d · ×{cell.count}</span>
                          </button>
                        ) : (
                          <div className={`flex h-14 w-20 items-center justify-center rounded-lg border ${RISK_CELL_STYLES.EMPTY}`}>
                            <span className="text-[10px]">—</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostUrgent.length > 0 && (
        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Most urgent batches</p>
          <div className="space-y-2">
            {mostUrgent.map((batch) => {
              const sku = skuById.get(batch.skuId)
              const batchValue = (sku?.unitCost ?? 0) * batch.quantity
              return (
                <div key={batch.id} className="flex items-center justify-between gap-4 rounded-lg border border-line/70 bg-ink/40 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-paper">
                      <span className="font-mono text-xs">{sku?.skuCode ?? batch.skuId}</span>
                      <span className="mx-1.5 text-mist">·</span>
                      <span className="font-mono text-xs">{dcById.get(batch.dcId)?.dcCode ?? batch.dcId}</span>
                      <span className="mx-1.5 text-mist">·</span>
                      batch {batch.batchNo}
                    </p>
                    <p className="mt-0.5 text-xs text-mist">
                      {batch.quantity.toLocaleString()} units · expires {batch.expiryDate}
                      {batch.daysUntilExpiry >= 0 ? ` (in ${batch.daysUntilExpiry}d)` : ` (${Math.abs(batch.daysUntilExpiry)}d ago)`}
                      {batchValue > 0 && (
                        <>
                          <span className="mx-1.5 text-mist/50">·</span>
                          <span className="text-alert">{formatINR(batchValue)}</span>
                          <span className="text-mist/70"> at risk</span>
                        </>
                      )}
                    </p>
                  </div>
                  <RiskBadge risk={batch.expiryRisk} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FEFO stack modal — opens when a cell is clicked */}
      {selectedCell && fefoStack.length > 0 && (
        <FefoStackModal
          sku={skuById.get(selectedCell.skuId)}
          dc={dcById.get(selectedCell.dcId)}
          stack={fefoStack}
          onClose={() => setSelectedCell(null)}
        />
      )}
      {selectedCell && fefoStack.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm" onClick={() => setSelectedCell(null)}>
          <div className="rounded-xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-mist">No batches on hand for this SKU × DC.</p>
            <button type="button" onClick={() => setSelectedCell(null)} className="mt-3 text-xs text-signal hover:underline">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Legend() {
  const items: { label: string; risk: ExpiryRisk }[] = [
    { label: 'OK', risk: 'OK' },
    { label: 'Warning', risk: 'WARNING' },
    { label: 'Critical', risk: 'CRITICAL' },
    { label: 'Expired', risk: 'EXPIRED' },
  ]
  return (
    <div className="hidden items-center gap-2 md:flex">
      {items.map((item) => (
        <span key={item.risk} className="flex items-center gap-1.5 text-[11px] text-mist">
          <span className={`h-2.5 w-2.5 rounded-sm border ${RISK_CELL_STYLES[item.risk]}`} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────
   FEFO STACK MODAL
   Shows the batch allocation order for a SKU × DC.
   The soonest-expiry batch is at the TOP — that's what FEFO allocates first.
   ────────────────────────────────────────────── */
interface FefoStackModalProps {
  sku: { name: string; skuCode: string; unitCost?: number } | undefined
  dc: { dcCode: string; name: string } | undefined
  stack: Array<{ id: string; batchNo: string; quantity: number; expiryDate: string; daysUntilExpiry: number; expiryRisk: ExpiryRisk; unitCost?: number }>
  onClose: () => void
}

function FefoStackModal({ sku, dc, stack, onClose }: FefoStackModalProps) {
  if (!sku || !dc) return null
  const totalQty = stack.reduce((s, b) => s + b.quantity, 0)
  const totalValue = stack.reduce((s, b) => s + (b.quantity * (sku.unitCost ?? 0)), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-ink/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist">FEFO allocation</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-paper">{sku.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-mist">
              {sku.skuCode} · {dc.dcCode} {dc.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-mist transition-colors hover:bg-white/5 hover:text-paper"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 border-b border-line px-5 py-3 text-center">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Batches</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-paper">{stack.length}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Total units</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-paper">{totalQty.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Value</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-signal">
              {formatINR(totalValue, { compact: false, decimals: 0 })}
            </p>
          </div>
        </div>

        {/* FEFO stack — arrow indicator showing dispatch order */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] text-mist">
            <span>Dispatch order</span>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span>soonest expiry first</span>
          </div>

          <div className="space-y-2">
            {stack.map((b, idx) => {
              const pct = (b.quantity / totalQty) * 100
              const isTop = idx === 0
              return (
                <div
                  key={b.id}
                  className={`relative overflow-hidden rounded-lg border p-3 ${
                    isTop
                      ? 'border-signal/40 bg-signal/10'
                      : b.expiryRisk === 'CRITICAL' || b.expiryRisk === 'EXPIRED'
                      ? 'border-critical/30 bg-critical/5'
                      : 'border-line/70 bg-ink/40'
                  }`}
                >
                  {/* Quantity bar (relative) */}
                  <div
                    className={`pointer-events-none absolute inset-y-0 left-0 ${
                      isTop ? 'bg-signal/10' : 'bg-white/[0.02]'
                    }`}
                    style={{ width: `${Math.max(8, pct)}%` }}
                  />

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold ${
                          isTop
                            ? 'bg-signal/30 text-signal'
                            : 'bg-panel2 text-mist'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-paper">batch {b.batchNo}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-mist">
                          {b.quantity.toLocaleString()} units
                          {sku.unitCost ? ` · ${formatINR(b.quantity * sku.unitCost, { compact: false, decimals: 0 })}` : ''}
                          {pct > 0 ? ` · ${pct.toFixed(0)}%` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs text-paper">
                        {b.daysUntilExpiry >= 0 ? `in ${b.daysUntilExpiry}d` : `${Math.abs(b.daysUntilExpiry)}d ago`}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-mist">{b.expiryDate}</p>
                    </div>
                    <RiskBadge risk={b.expiryRisk} />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-[11px] text-mist/70">
            Per FEFO policy, the first batch is consumed first. Action: transfer out, allocate to a faster-moving DC, or accept write-off when expires.
          </p>
        </div>
      </div>
    </div>
  )
}
