import { useEffect, useMemo, useState } from 'react'

import { p1Client } from '../../api/p1Client'
import { RefreshButton } from '../../components/badges'
import { useReferenceData } from '../../hooks/useReferenceData'

interface DemandSignal {
  id: string
  skuId: string
  dcId: string
  signalDate: string
  historicalDemand: number
  sensedAdjustmentPct: number
  source: string
}

type LoadState = 'loading' | 'ok' | 'error'

export default function DemandSignalsView() {
  const { skus, dcs, skuById, dcById } = useReferenceData()
  const [signals, setSignals] = useState<DemandSignal[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [skuFilter, setSkuFilter] = useState('')
  const [dcFilter, setDcFilter] = useState('')

  const load = () => {
    setState('loading')
    const params: Record<string, string> = {}
    if (skuFilter) params.skuId = skuFilter
    if (dcFilter) params.dcId = dcFilter

    p1Client
      .get<{ data: DemandSignal[] }>('/demand-signals', { params })
      .then((response) => {
        setSignals(response.data.data)
        setState('ok')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [skuFilter, dcFilter])

  const spikeCount = useMemo(
    () => signals.filter((signal) => signal.sensedAdjustmentPct > 0).length,
    [signals],
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">Demand signals</h2>
          <p className="mt-1 text-sm text-mist">
            Historical demand and sensed adjustments captured from the live P1 signal stream.
          </p>
        </div>
        <RefreshButton onClick={load} loading={state === 'loading'} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="Signals loaded" value={state === 'ok' ? signals.length.toLocaleString() : '···'} />
        <Metric label="Active spikes" value={state === 'ok' ? spikeCount.toLocaleString() : '···'} />
        <Metric
          label="Latest signal"
          value={state === 'ok' && signals[0] ? signals[0].signalDate : '—'}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={skuFilter}
          onChange={(event) => setSkuFilter(event.target.value)}
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
          onChange={(event) => setDcFilter(event.target.value)}
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
          <p className="p-6 text-sm text-critical">Couldn&apos;t reach the P1 API. Check the backend connection and refresh.</p>
        ) : state === 'ok' && signals.length === 0 ? (
          <p className="p-6 text-sm text-mist">No demand signals match these filters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-panel2/60 font-mono text-[10px] uppercase tracking-wider text-mist">
                <th className="px-4 py-3 font-medium">Signal date</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Distribution center</th>
                <th className="px-4 py-3 text-right font-medium">Historical</th>
                <th className="px-4 py-3 text-right font-medium">Adjustment</th>
                <th className="px-4 py-3 text-right font-medium">Sensed demand</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {state === 'loading'
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b border-line/60">
                      <td className="px-4 py-3" colSpan={7}>
                        <div className="h-4 w-full animate-pulse rounded bg-panel2" />
                      </td>
                    </tr>
                  ))
                : signals.map((signal) => {
                    const sensedDemand = signal.historicalDemand * (1 + signal.sensedAdjustmentPct / 100)
                    return (
                      <tr key={signal.id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                        <td className="px-4 py-3 font-mono text-xs text-paper">{signal.signalDate}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-paper">{skuById.get(signal.skuId)?.skuCode ?? signal.skuId}</span>
                          <span className="ml-2 text-mist">{skuById.get(signal.skuId)?.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-paper">{dcById.get(signal.dcId)?.dcCode ?? signal.dcId}</span>
                          <span className="ml-2 text-mist">{dcById.get(signal.dcId)?.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-paper">{signal.historicalDemand.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-mono ${signal.sensedAdjustmentPct > 0 ? 'text-alert' : 'text-mist'}`}>
                          {signal.sensedAdjustmentPct > 0 ? '+' : ''}{signal.sensedAdjustmentPct}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-signal">{sensedDemand.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-mist">{signal.source}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-signal">{value}</p>
    </div>
  )
}