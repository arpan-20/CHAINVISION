import { useEffect, useMemo, useState } from 'react'

import { p1Client } from '../../api/p1Client'
import { RefreshButton, RiskBadge, RISK_CELL_STYLES, type ExpiryRisk } from '../../components/badges'
import { useReferenceData } from '../../hooks/useReferenceData'

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
      { worst: ExpiryRisk; count: number; soonestDays: number }
    >()

    for (const batch of batches) {
      const key = `${batch.skuId}:${batch.dcId}`
      const existing = cells.get(key)
      if (!existing || RISK_RANK[batch.expiryRisk] > RISK_RANK[existing.worst]) {
        cells.set(key, {
          worst: batch.expiryRisk,
          count: (existing?.count ?? 0) + 1,
          soonestDays: Math.min(existing?.soonestDays ?? Infinity, batch.daysUntilExpiry),
        })
      } else {
        cells.set(key, {
          ...existing,
          count: existing.count + 1,
          soonestDays: Math.min(existing.soonestDays, batch.daysUntilExpiry),
        })
      }
    }
    return cells
  }, [batches])

  const rowSkus = useMemo(() => {
    const activeSkuIds = new Set(batches.map((b) => b.skuId))
    return skus.filter((sku) => activeSkuIds.has(sku.id))
  }, [skus, batches])

  const colDcs = useMemo(() => {
    const activeDcIds = new Set(batches.map((b) => b.dcId))
    return dcs.filter((dc) => activeDcIds.has(dc.id))
  }, [dcs, batches])

  const mostUrgent = useMemo(
    () =>
      [...batches]
        .filter((b) => b.expiryRisk === 'CRITICAL' || b.expiryRisk === 'EXPIRED')
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
        .slice(0, 8),
    [batches],
  )

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
                          <div
                            title={`${cell.count} batch(es) · soonest expiry in ${cell.soonestDays}d`}
                            className={`flex h-14 w-20 flex-col items-center justify-center rounded-lg border font-mono transition-transform hover:scale-[1.04] ${RISK_CELL_STYLES[cell.worst]}`}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wide">{cell.worst}</span>
                            <span className="text-[10px] opacity-80">{cell.soonestDays}d · ×{cell.count}</span>
                          </div>
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
            {mostUrgent.map((batch) => (
              <div key={batch.id} className="flex items-center justify-between gap-4 rounded-lg border border-line/70 bg-ink/40 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-paper">
                    <span className="font-mono text-xs">{skuById.get(batch.skuId)?.skuCode ?? batch.skuId}</span>
                    <span className="mx-1.5 text-mist">·</span>
                    <span className="font-mono text-xs">{dcById.get(batch.dcId)?.dcCode ?? batch.dcId}</span>
                    <span className="mx-1.5 text-mist">·</span>
                    batch {batch.batchNo}
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    {batch.quantity.toLocaleString()} units · expires {batch.expiryDate}
                    {batch.daysUntilExpiry >= 0 ? ` (in ${batch.daysUntilExpiry}d)` : ` (${Math.abs(batch.daysUntilExpiry)}d ago)`}
                  </p>
                </div>
                <RiskBadge risk={batch.expiryRisk} />
              </div>
            ))}
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
