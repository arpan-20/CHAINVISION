import { useState, type ReactNode } from 'react'

import { pr2Client } from '../../api/pr2Client'
import type { Urgency } from '../../components/badges'
import type { DcRef, SkuRef } from '../../hooks/useReferenceData'

// ---------------------------------------------------------------------------
// The demo's flagship moment (Documentaion/00_PROJECT_CONTEXT.md Section 16
// step 4): a planner types something like
//   "We need 5,000 more units of MED-104 for the flu season."
// and Gemini extracts a structured guess. Section 9's hard rule governs this
// component: POST /api/requisitions/parse-intent NEVER persists anything by
// itself — it only returns a suggestion. This UI must always route through
// an editable confirm step before POST /api/requisitions is called. There is
// no "auto-submit on high confidence" path, by design.
// ---------------------------------------------------------------------------

interface IntentExtractionResult {
  skuGuess: string | null
  quantity: number | null
  dcGuess: string | null
  urgency: string | null
  confidence: number | null
  manualEntryRequired: boolean | null
}

type ChatState = 'idle' | 'parsing' | 'confirming' | 'submitting' | 'error' | 'created'

const URGENCY_OPTIONS: Urgency[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function normalizeUrgency(value: string | null): Urgency {
  const upper = (value ?? '').toUpperCase()
  return (URGENCY_OPTIONS as string[]).includes(upper) ? (upper as Urgency) : 'MEDIUM'
}

/** Best-effort match of Gemini's free-text guess onto a known SKU/DC code. */
function resolveGuess<T extends { skuCode?: string; dcCode?: string }>(
  guess: string | null,
  refs: T[],
  field: 'skuCode' | 'dcCode',
): string {
  if (!guess) return ''
  const exact = refs.find((r) => r[field]?.toLowerCase() === guess.toLowerCase())
  if (exact) return exact[field] as string
  const partial = refs.find((r) => r[field]?.toLowerCase().includes(guess.toLowerCase()))
  return (partial?.[field] as string) ?? guess
}

export default function NlRequisitionChatbot({
  onRequisitionCreated,
  skus,
  dcs,
}: {
  onRequisitionCreated: () => void
  skus: SkuRef[]
  dcs: DcRef[]
}) {
  const [text, setText] = useState('')
  const [rawInputAtParse, setRawInputAtParse] = useState('')
  const [state, setState] = useState<ChatState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [guess, setGuess] = useState<IntentExtractionResult | null>(null)

  // Editable confirm-form fields, pre-filled from the guess but never
  // submitted until the human clicks Confirm.
  const [skuCode, setSkuCode] = useState('')
  const [dcCode, setDcCode] = useState('')
  const [quantity, setQuantity] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('MEDIUM')

  const submitText = () => {
    if (!text.trim()) return
    setState('parsing')
    setErrorMessage('')
    const submittedText = text.trim()

    pr2Client
      .post<IntentExtractionResult>('/requisitions/parse-intent', { text: submittedText })
      .then((response) => {
        const result = response.data
        setGuess(result)
        setRawInputAtParse(submittedText)
        setSkuCode(resolveGuess(result.skuGuess, skus, 'skuCode'))
        setDcCode(resolveGuess(result.dcGuess, dcs, 'dcCode'))
        setQuantity(result.quantity != null ? String(result.quantity) : '')
        setUrgency(normalizeUrgency(result.urgency))
        setState('confirming')
      })
      .catch(() => {
        setErrorMessage("Couldn't reach Gemini's intent extraction. Try again, or enter the requisition manually.")
        setState('error')
      })
  }

  const confirm = () => {
    if (!skuCode || !dcCode || !quantity) {
      setErrorMessage('SKU, DC, and quantity are required before confirming.')
      return
    }
    setState('submitting')
    setErrorMessage('')

    // Section 9 hard rule in action: this is the ONLY call in this component
    // that persists anything, and it only fires after an explicit click.
    // rawNlInput preserves the original sentence for audit/demo purposes.
    pr2Client
      .post('/requisitions', {
        skuCode,
        dcCode,
        quantity: Number(quantity),
        urgency,
        rawNlInput: rawInputAtParse,
      })
      .then(() => {
        setState('created')
        onRequisitionCreated()
      })
      .catch(() => {
        setErrorMessage('Could not create the requisition from your confirmed values. Check them and retry.')
        setState('confirming')
      })
  }

  const reset = () => {
    setText('')
    setRawInputAtParse('')
    setGuess(null)
    setSkuCode('')
    setDcCode('')
    setQuantity('')
    setUrgency('MEDIUM')
    setErrorMessage('')
    setState('idle')
  }

  return (
    <div className="animate-rise-in rounded-xl border border-signal/30 bg-panel p-5">
      <div className="flex items-center gap-2">
        <SparkleIcon className="h-4 w-4 text-signal" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
          Ask for a requisition, in plain English
        </p>
      </div>

      {(state === 'idle' || state === 'parsing' || state === 'error') && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitText()
              }
            }}
            placeholder="e.g. We need 5,000 more units of MED-104 for the flu season."
            disabled={state === 'parsing'}
            className="flex-1 rounded-lg border border-line bg-panel2 px-3.5 py-2.5 text-sm text-paper placeholder:text-mist/60 focus:border-signal/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={submitText}
            disabled={state === 'parsing' || !text.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === 'parsing' ? 'Asking Gemini…' : 'Send'}
          </button>
        </div>
      )}

      {errorMessage && <p className="mt-2 text-xs text-critical">{errorMessage}</p>}

      {(state === 'confirming' || state === 'submitting') && guess && (
        <div className="mt-4 rounded-lg border border-line bg-ink/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-mist">
              Gemini's suggestion — review before confirming
            </p>
            <ConfidencePill confidence={guess.confidence} manualEntryRequired={guess.manualEntryRequired} />
          </div>
          <p className="mt-2 text-sm italic text-mist">“{rawInputAtParse}”</p>

          {guess.manualEntryRequired && (
            <p className="mt-2 text-xs text-alert">
              Confidence was too low for a clean guess — please fill in or correct the fields below.
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="SKU code">
              <input
                list="chatbot-sku-options"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                disabled={state === 'submitting'}
                className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
              />
              <datalist id="chatbot-sku-options">
                {skus.map((s) => (
                  <option key={s.skuCode} value={s.skuCode}>
                    {s.name}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="DC code">
              <input
                list="chatbot-dc-options"
                value={dcCode}
                onChange={(e) => setDcCode(e.target.value)}
                disabled={state === 'submitting'}
                className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
              />
              <datalist id="chatbot-dc-options">
                {dcs.map((d) => (
                  <option key={d.dcCode} value={d.dcCode}>
                    {d.name}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={state === 'submitting'}
                className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
              />
            </Field>
            <Field label="Urgency">
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
                disabled={state === 'submitting'}
                className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-paper focus:border-signal/50 focus:outline-none"
              >
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u.charAt(0) + u.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {errorMessage && <p className="mt-3 text-xs text-critical">{errorMessage}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={state === 'submitting'}
              className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-mist transition-colors hover:text-paper"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={state === 'submitting'}
              className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === 'submitting' ? 'Creating…' : 'Confirm & create requisition'}
            </button>
          </div>
        </div>
      )}

      {state === 'created' && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-signal/30 bg-signal/10 px-4 py-3">
          <p className="text-sm text-paper">
            Requisition created from your confirmed values. It now shows up in the table below.
          </p>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-paper hover:border-signal/40"
          >
            Ask another
          </button>
        </div>
      )}
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

function ConfidencePill({
  confidence,
  manualEntryRequired,
}: {
  confidence: number | null
  manualEntryRequired: boolean | null
}) {
  const pct = confidence != null ? Math.round(confidence * 100) : 0
  const tone = manualEntryRequired ? 'text-alert border-alert/30 bg-alert/10' : 'text-signal border-signal/30 bg-signal/10'
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}>
      Confidence {pct}%
    </span>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8" />
    </svg>
  )
}
