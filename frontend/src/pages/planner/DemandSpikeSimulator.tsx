import { useState, type ReactNode } from 'react'

import { p1Client } from '../../api/p1Client'
import type { DcRef, SkuRef } from '../../hooks/useReferenceData'

type Step = 'idle' | 'signal' | 'recalculating' | 'done' | 'error'

interface RecalculateSummary {
  count: number
  byUrgency: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number>
}

export default function DemandSpikeSimulator({
  skus,
  dcs,
  onRecommendationsUpdated,
}: {
  skus: SkuRef[]
  dcs: DcRef[]
  onRecommendationsUpdated: () => void
}) {
  const [skuId, setSkuId] = useState('')
  const [dcId, setDcId] = useState('')
  const [adjustmentPct, setAdjustmentPct] = useState(60)
  const [historicalDemand, setHistoricalDemand] = useState(500)
  const [step, setStep] = useState<Step>('idle')
  const [summary, setSummary] = useState<RecalculateSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = skuId && dcId && step !== 'signal' && step !== 'recalculating'

  const runSimulation = async () => {
    setErrorMessage('')
    setSummary(null)
    setStep('signal')
    try {
      await p1Client.post('/demand-signals', {
        skuId,
        dcId,
        historicalDemand,
        sensedAdjustmentPct: adjustmentPct,
        source: 'planner-demand-spike-simulator',
      })

      setStep('recalculating')
      const recalcResponse = await p1Client.post<{
        data: { count: number; byUrgency: RecalculateSummary['byUrgency'] }
      }>('/replenishment/recalculate', { skuId, dcId })

      setSummary(recalcResponse.data.data)
      setStep('done')
      onRecommendationsUpdated()
    } catch (error) {
      const message = axiosMessage(error)
      setErrorMessage(message)
      setStep('error')
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Demo trigger</p>
          <h3 className="mt-0.5 font-display text-base font-semibold text-paper">Demand spike simulator</h3>
        </div>
        <StepIndicator step={step} />
      </div>

      <p className="mb-4 max-w-2xl text-sm text-mist">
        Sends a sensed-demand signal for a SKU/DC, then triggers a targeted replenishment
        recalculation — the exact moment a Tier-2 flu-season spike turns into a fresh
        recommendation.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SKU">
          <select
            value={skuId}
            onChange={(e) => setSkuId(e.target.value)}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          >
            <option value="">Select SKU…</option>
            {skus.map((sku) => (
              <option key={sku.id} value={sku.id}>
                {sku.skuCode} · {sku.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Distribution center">
          <select
            value={dcId}
            onChange={(e) => setDcId(e.target.value)}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          >
            <option value="">Select DC…</option>
            {dcs.map((dc) => (
              <option key={dc.id} value={dc.id}>
                {dc.dcCode} · {dc.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sensed adjustment (%)">
          <input
            type="number"
            value={adjustmentPct}
            onChange={(e) => setAdjustmentPct(Number(e.target.value))}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          />
        </Field>

        <Field label="Baseline historical demand">
          <input
            type="number"
            value={historicalDemand}
            onChange={(e) => setHistoricalDemand(Number(e.target.value))}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runSimulation}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          Trigger demand spike
        </button>

        {step === 'done' && summary && (
          <p className="text-sm text-signal">
            {summary.count} recommendation{summary.count === 1 ? '' : 's'} generated — CRITICAL{' '}
            {summary.byUrgency.CRITICAL}, HIGH {summary.byUrgency.HIGH}, MEDIUM {summary.byUrgency.MEDIUM}, LOW{' '}
            {summary.byUrgency.LOW}.
          </p>
        )}

        {step === 'error' && <p className="text-sm text-critical">{errorMessage}</p>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">{label}</span>
      {children}
    </label>
  )
}

function StepIndicator({ step }: { step: Step }) {
  if (step === 'idle') return null
  const labels: Record<Step, string> = {
    idle: '',
    signal: 'Recording demand signal…',
    recalculating: 'Recalculating replenishment…',
    done: 'Recommendation ready',
    error: 'Failed',
  }
  const tone =
    step === 'error' ? 'text-critical' : step === 'done' ? 'text-signal' : 'text-alert'
  return (
    <span className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${tone}`}>
      {(step === 'signal' || step === 'recalculating') && (
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />
      )}
      {labels[step]}
    </span>
  )
}

function axiosMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
  ) {
    return (error as { response: { data: { error: string } } }).response.data.error
  }
  return 'Something went wrong reaching the P1 API — check the backend connection.'
}
