import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { pr2Client } from '../../api/pr2Client'
import { ChevronIcon } from '../../components/icons'
import { useAuthStub } from '../../hooks/useAuthStub'
import { PROCUREMENT_NAV_ITEMS } from './ProcurementLayout'

interface SupplierSummary {
  id: string
  name: string
  priceIndex: number
  avgLeadTimeDays: number
  otdScore: number
  qualityScore: number
  capacityUnits: number
}

type FetchState = 'loading' | 'ok' | 'error'

const MODULE_DESCRIPTIONS: Record<string, string> = {
  '/procurement/requisitions': 'System-generated and manual purchase requisitions, from P1 recommendations to sign-off.',
  '/procurement/purchase-orders': 'POs issued to suppliers, with deterministic scoring/ranking behind each selection.',
  '/procurement/goods-receipt': 'Goods received against open POs, batch and quantity confirmed at the dock.',
  '/procurement/invoices': 'Uploaded supplier invoices, OCR-extracted and queued for 3-way match.',
  '/procurement/exceptions': 'Mismatches between PO, GRN, and invoice — with a plain-English explanation.',
  '/procurement/analytics': 'Spend, supplier performance, and cycle-time trends across the P2P flow.',
}

// Module cards mirror the sidebar nav (minus Overview itself) so the
// landing page and the nav always describe the same six modules.
const MODULES = PROCUREMENT_NAV_ITEMS.filter((item) => item.to !== '/procurement').map((item) => ({
  to: item.to,
  icon: item.icon,
  title: item.label,
  description: MODULE_DESCRIPTIONS[item.to],
}))

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ProcurementHome() {
  const { user, loading: userLoading } = useAuthStub()
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [supplierState, setSupplierState] = useState<FetchState>('loading')

  useEffect(() => {
    let cancelled = false

    pr2Client
      .get<SupplierSummary[]>('/suppliers')
      .then((response) => {
        if (cancelled) return
        // Temporary — confirms pr2Client reaches the live PR2 backend.
        // Remove once P19.2/P19.3 land real procurement views.
        console.log('[ProcurementHome] GET /api/suppliers →', response.data)
        setSuppliers(response.data)
        setSupplierState('ok')
      })
      .catch(() => {
        if (!cancelled) setSupplierState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Greeting */}
      <div className="animate-rise-in">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-paper md:text-3xl">
          {greeting(new Date().getHours())}
          {!userLoading && user ? `, ${user.name.split(' ')[0]}` : ''}.
        </h2>
        <p className="mt-1.5 text-sm text-mist">
          {userLoading
            ? 'Syncing your session…'
            : `Watching procure-to-pay across ${user?.dc} and the wider MedCare Pharma network.`}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiTile
          label="Suppliers onboarded"
          value={supplierState === 'ok' ? String(suppliers.length) : supplierState === 'error' ? 'Offline' : '···'}
          tone={supplierState === 'error' ? 'critical' : 'signal'}
          caption={supplierState === 'error' ? 'Check PR2 API connection' : 'Live from PR2 API'}
        />
        <KpiTile label="Open requisitions" value="—" tone="mist" caption="Live in P19.2" />
        <KpiTile label="POs awaiting receipt" value="—" tone="mist" caption="Live in P19.2" />
        <KpiTile label="Exceptions queued" value="—" tone="mist" caption="Live in P19.3" />
      </div>

      {/* Module cards */}
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Procurement modules</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODULES.map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-4 rounded-xl border border-line bg-panel p-5 transition-colors hover:border-signal/40 hover:bg-panel2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-signal transition-transform group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold text-paper">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-mist">{description}</p>
              </div>
              <ChevronIcon className="mt-1 h-4 w-4 shrink-0 text-mist transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
            </Link>
          ))}
        </div>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist/70">
        Running on a temporary auth stub — Phase 23 swaps in Supabase Auth.
      </p>
    </div>
  )
}

function KpiTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string
  value: string
  caption: string
  tone: 'signal' | 'critical' | 'mist'
}) {
  const toneClass = { signal: 'text-signal', critical: 'text-critical', mist: 'text-paper/40' }[tone]
  return (
    <div className="animate-rise-in rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-mist/80">{caption}</p>
    </div>
  )
}