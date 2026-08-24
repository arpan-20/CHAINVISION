import { useEffect, useMemo, useState } from 'react'

import { p1Client } from '../../api/p1Client'
import { RefreshButton } from '../../components/badges'
import { useReferenceData } from '../../hooks/useReferenceData'

interface StockRow {
  skuId: string
  dcId: string
  currentStock: number
  batchCount: number
}

type SortField = 'sku' | 'dc' | 'currentStock' | 'batchCount'
type SortDir = 'asc' | 'desc'
type LoadState = 'loading' | 'ok' | 'error'

export default function InventoryView() {
  const { skus, dcs, skuById, dcById } = useReferenceData()

  const [rows, setRows] = useState<StockRow[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [skuFilter, setSkuFilter] = useState('')
  const [dcFilter, setDcFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('sku')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = () => {
    setState('loading')
    const params: Record<string, string> = {}
    if (skuFilter) params.skuId = skuFilter
    if (dcFilter) params.dcId = dcFilter

    p1Client
      .get<{ data: { stock: StockRow[] } }>('/inventory', { params })
      .then((response) => {
        setRows(response.data.data.stock)
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [skuFilter, dcFilter])

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    const withLabels = rows.map((row) => ({
      ...row,
      skuLabel: skuById.get(row.skuId)?.skuCode ?? row.skuId,
      skuName: skuById.get(row.skuId)?.name ?? '—',
      dcLabel: dcById.get(row.dcId)?.dcCode ?? row.dcId,
      dcName: dcById.get(row.dcId)?.name ?? '—',
    }))

    const dir = sortDir === 'asc' ? 1 : -1
    return withLabels.sort((a, b) => {
      switch (sortField) {
        case 'sku':
          return a.skuLabel.localeCompare(b.skuLabel) * dir
        case 'dc':
          return a.dcLabel.localeCompare(b.dcLabel) * dir
        case 'currentStock':
          return (a.currentStock - b.currentStock) * dir
        case 'batchCount':
          return (a.batchCount - b.batchCount) * dir
        default:
          return 0
      }
    })
  }, [rows, skuById, dcById, sortField, sortDir])

  const totalUnits = rows.reduce((sum, row) => sum + row.currentStock, 0)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
            Current inventory
          </h2>
          <p className="mt-1 text-sm text-mist">
            {state === 'ok' ? `${rows.length} SKU/DC positions · ${totalUnits.toLocaleString()} units on hand` : 'Loading current stock…'}
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
        >
          <option value="">All SKUs</option>
          {skus.map((sku) => (
            <option key={sku.id} value={sku.id}>
              {sku.skuCode} · {sku.name}
            </option>
          ))}
        </select>
        <select
          value={dcFilter}
          onChange={(e) => setDcFilter(e.target.value)}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
        >
          <option value="">All distribution centers</option>
          {dcs.map((dc) => (
            <option key={dc.id} value={dc.id}>
              {dc.dcCode} · {dc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {state === 'error' ? (
          <p className="p-6 text-sm text-critical">Couldn't reach the P1 API. Check the backend connection and refresh.</p>
        ) : state === 'ok' && sortedRows.length === 0 ? (
          <p className="p-6 text-sm text-mist">No stock positions match these filters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-panel2/60 font-mono text-[10px] uppercase tracking-wider text-mist">
                <SortableHeader label="SKU" field="sku" active={sortField} dir={sortDir} onClick={toggleSort} />
                <SortableHeader label="Distribution center" field="dc" active={sortField} dir={sortDir} onClick={toggleSort} />
                <SortableHeader label="Current stock" field="currentStock" active={sortField} dir={sortDir} onClick={toggleSort} align="right" />
                <SortableHeader label="Batches" field="batchCount" active={sortField} dir={sortDir} onClick={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {state === 'loading'
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3" colSpan={4}>
                        <div className="h-4 w-full animate-pulse rounded bg-panel2" />
                      </td>
                    </tr>
                  ))
                : sortedRows.map((row) => (
                    <tr key={`${row.skuId}:${row.dcId}`} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-paper">{row.skuLabel}</span>
                        <span className="ml-2 text-mist">{row.skuName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-paper">{row.dcLabel}</span>
                        <span className="ml-2 text-mist">{row.dcName}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-paper">
                        {row.currentStock.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-mist">{row.batchCount}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SortableHeader({
  label,
  field,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  field: SortField
  active: SortField
  dir: SortDir
  onClick: (field: SortField) => void
  align?: 'left' | 'right'
}) {
  const isActive = active === field
  return (
    <th className={`px-4 py-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-paper ${isActive ? 'text-signal' : ''}`}
      >
        {label}
        {isActive && <span>{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}
