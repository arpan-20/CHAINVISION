import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { pr2Client } from '../../api/pr2Client'
import { ChevronIcon } from '../../components/icons'
import { useAuth } from '../../hooks/useAuth'
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

interface RequisitionSummary {
  id: string
  status: 'CREATED' | 'SOURCED' | 'PO_RAISED'
}

interface PurchaseOrderSummary {
  id: string
  status: 'ISSUED' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED'
}

interface ExceptionSummary {
  invoice: {
    id: string
  }
}

type FetchState = 'loading' | 'ok' | 'error'

interface ProcurementMetrics {
  supplierCount: number
  openRequisitionCount: number
  poAwaitingReceiptCount: number
  exceptionCount: number
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  '/procurement/requisitions': 'System-generated and manual purchase requisitions, from P1 recommendations to sign-off.',
  '/procurement/purchase-orders': 'POs issued to suppliers, with deterministic scoring/ranking behind each selection.',
  '/procurement/goods-receipt': 'Goods received against open POs, batch and quantity confirmed at the dock.',
  '/procurement/invoices': 'Uploaded supplier invoices, OCR-extracted and queued for 3-way match.',
  '/procurement/exceptions': 'Mismatches between PO, GRN, and invoice, with a plain-English explanation.',
  '/procurement/analytics': 'Spend, supplier performance, and cycle-time trends across the P2P flow.',
}

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
  const { user, loading: userLoading } = useAuth()
  const [metrics, setMetrics] = useState<ProcurementMetrics | null>(null)
  const [metricsState, setMetricsState] = useState<FetchState>('loading')

  useEffect(() => {
    let cancelled = false

    Promise.all([
      pr2Client.get<SupplierSummary[]>('/suppliers'),
      pr2Client.get<RequisitionSummary[]>('/requisitions'),
      pr2Client.get<PurchaseOrderSummary[]>('/purchase-orders'),
      pr2Client.get<ExceptionSummary[]>('/exceptions'),
    ])
      .then(([supplierRes, requisitionRes, poRes, exceptionRes]) => {
        if (cancelled) return

        setMetrics({
          supplierCount: supplierRes.data.length,
          openRequisitionCount: requisitionRes.data.filter((req) => req.status !== 'PO_RAISED').length,
          poAwaitingReceiptCount: poRes.data.filter((po) =>
            ['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(po.status),
          ).length,
          exceptionCount: exceptionRes.data.length,
        })
        setMetricsState('ok')
      })
      .catch(() => {
        if (!cancelled) setMetricsState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="animate-rise-in">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-paper md:text-3xl">
          {greeting(new Date().getHours())}
          {!userLoading && user ? `, ${user.name.split(' ')[0]}` : ''}.
        </h2>
        <p className="mt-1.5 text-sm text-mist">
          {userLoading
            ? 'Syncing your session...'
            : `Watching procure-to-pay across ${user?.dc} and the wider MedCare Pharma network.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiTile
          label="Suppliers onboarded"
          value={metricValue(metricsState, metrics?.supplierCount)}
          tone={metricsState === 'error' ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Live from PR2 API'}
        />
        <KpiTile
          label="Open requisitions"
          value={metricValue(metricsState, metrics?.openRequisitionCount)}
          tone={metricsState === 'error' ? 'critical' : (metrics?.openRequisitionCount ?? 0) > 0 ? 'signal' : 'mist'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Awaiting PO creation'}
        />
        <KpiTile
          label="POs awaiting receipt"
          value={metricValue(metricsState, metrics?.poAwaitingReceiptCount)}
          tone={metricsState === 'error' ? 'critical' : (metrics?.poAwaitingReceiptCount ?? 0) > 0 ? 'signal' : 'mist'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Open dock confirmations'}
        />
        <KpiTile
          label="Exceptions queued"
          value={metricValue(metricsState, metrics?.exceptionCount)}
          tone={metricsState === 'error' ? 'critical' : (metrics?.exceptionCount ?? 0) > 0 ? 'critical' : 'signal'}
          caption={metricsState === 'error' ? 'Check PR2 API connection' : 'Needs human review'}
        />
      </div>

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
        Demo procurement session active
      </p>
    </div>
  )
}

function metricValue(state: FetchState, value: number | undefined) {
  if (state === 'error') return 'Offline'
  if (state === 'loading') return '...'
  return String(value ?? 0)
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
