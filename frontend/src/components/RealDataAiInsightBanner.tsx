import { useEffect, useMemo, useState } from 'react'

import { p1Client } from '../api/p1Client'
import { pr2Client } from '../api/pr2Client'
import { formatINR } from '../lib/format'
import AiInsightBanner, { type Insight } from './AiInsightBanner'

/* ──────────────────────────────────────────────
   REAL-DATA AI INSIGHT BANNER
   Pulls counts from the actual API endpoints (no backend changes)
   and rotates through derived insights. Replaces SAMPLE_INSIGHTS.
   ────────────────────────────────────────────── */
export default function RealDataAiInsightBanner({ className = '' }: { className?: string }) {
  const [insights, setInsights] = useState<Insight[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      Promise.all([
        p1Client.get<{ data: Array<{ recommendedQty: number; urgency: string; status: string; skuId: string; dcId: string; reasonCode: string }> }>(
          '/replenishment/recommendations',
        ),
        p1Client.get<{
          data: {
            data?: {
              stock?: Array<unknown>
              batches?: Array<{
                daysUntilExpiry: number
                expiryRisk: string
                quantity: number
                skuId: string
                dcId: string
              }>
            }
          }
        }>('/inventory', { params: { detail: 'batches' } }),
        pr2Client.get<Array<{ invoice: { totalOcr: number | null }; paymentApproval: { status: string } }>>('/exceptions'),
      ])
        .then(([recRes, invRes, excRes]) => {
          if (cancelled) return
          const recs = (recRes.data?.data ?? []) as Array<{
            recommendedQty: number
            urgency: string
            status: string
            skuId: string
            dcId: string
            reasonCode: string
          }>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inventoryBody = (invRes as any)?.data?.data ?? (invRes as any)?.data ?? {}
          const batches = ((inventoryBody as { batches?: unknown[] }).batches ?? []) as Array<{
            daysUntilExpiry: number
            expiryRisk: string
            quantity: number
            skuId: string
            dcId: string
          }>
          const exceptions = (excRes.data ?? []) as Array<{
            invoice: { totalOcr: number | null }
            paymentApproval: { status: string }
          }>
          const skusById = new Map<string, { name: string; unitCost: number }>()
          p1Client
            .get<{ data: Array<{ id: string; name: string; unitCost?: number }> }>('/skus')
            .then((s) => {
              if (cancelled) return
              ;(s.data.data || []).forEach((sku) => {
                skusById.set(sku.id, { name: sku.name, unitCost: sku.unitCost ?? 0 })
              })
              const built = buildInsights(recs, batches, exceptions, skusById)
              if (!cancelled) setInsights(built)
            })
            .catch(() => {
              if (cancelled) return
              // Fall back to count-only insights (no ₹ values) if /skus fails
              const built = buildInsights(recs, batches, exceptions, new Map())
              setInsights(built)
            })
        })
        .catch(() => {
          if (cancelled) return
          // Backend offline — show a single non-rotating insight
          setInsights([
            {
              id: 'offline',
              severity: 'info',
              title: 'Backend offline',
              detail: 'Connect P1 + PR2 services to see real-time supply chain signals.',
            },
          ])
        })
    }
    load()
    // Refresh every 60s to pick up new data
    const interval = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Don't render anything until we have data, OR the offline state
  if (!insights) return null
  return <AiInsightBanner insights={insights} className={className} />
}

function buildInsights(
  recommendations: Array<{ recommendedQty: number; urgency: string; status: string; skuId: string; dcId: string; reasonCode: string }>,
  batches: Array<{ daysUntilExpiry: number; expiryRisk: string; quantity: number; skuId: string; dcId: string }>,
  exceptions: Array<{ invoice: { totalOcr: number | null }; paymentApproval: { status: string } }>,
  skusById: Map<string, { name: string; unitCost: number }>,
): Insight[] {
  const built: Insight[] = []

  // 1. Critical/expired batches → write-off exposure
  const criticalBatches = batches.filter(
    (b) => b.expiryRisk === 'CRITICAL' || b.expiryRisk === 'EXPIRED',
  )
  if (criticalBatches.length > 0) {
    const writeOffExposure = criticalBatches.reduce(
      (sum, b) => sum + (skusById.get(b.skuId)?.unitCost ?? 0) * b.quantity,
      0,
    )
    const skuName = criticalBatches[0]
      ? skusById.get(criticalBatches[0].skuId)?.name ?? 'SKU'
      : 'SKU'
    const dcCount = new Set(criticalBatches.map((b) => b.dcId)).size
    built.push({
      id: 'expiry',
      severity: 'warning',
      title: `${criticalBatches.length} batch${criticalBatches.length === 1 ? '' : 'es'} expiring within 7 days`,
      detail: `Across ${dcCount} DC${dcCount === 1 ? '' : 's'}. ${writeOffExposure > 0 ? `Estimated write-off exposure ${formatINR(writeOffExposure)}.` : ''} Issue POs or transfer before expiry.`,
      cta: { label: 'Review batches', href: '/planner/expiry-risk' },
    })
  }

  // 2. Replenishment value at risk
  const openRecs = recommendations.filter((r) => r.status === 'NEW')
  if (openRecs.length > 0) {
    const totalValue = openRecs.reduce(
      (sum, r) => sum + (skusById.get(r.skuId)?.unitCost ?? 0) * r.recommendedQty,
      0,
    )
    const criticalRecs = openRecs.filter((r) => r.urgency === 'CRITICAL').length
    built.push({
      id: 'recs',
      severity: criticalRecs > 0 ? 'critical' : 'info',
      title: `${openRecs.length} replenishment recommendation${openRecs.length === 1 ? '' : 's'} pending review`,
      detail: `${totalValue > 0 ? `Total PO value ${formatINR(totalValue)}.` : ''} ${criticalRecs > 0 ? `${criticalRecs} marked CRITICAL.` : ''} Forward to procurement with one click.`,
      cta: { label: 'Review plans', href: '/planner/replenishment' },
    })
  }

  // 3. Exception queue value
  if (exceptions.length > 0) {
    const disputedValue = exceptions.reduce((sum, e) => sum + (e.invoice.totalOcr ?? 0), 0)
    built.push({
      id: 'exceptions',
      severity: 'critical',
      title: `${exceptions.length} invoice${exceptions.length === 1 ? '' : 's'} failing 3-way match`,
      detail: `${disputedValue > 0 ? `Disputed value ${formatINR(disputedValue)}.` : ''} AI-generated plain-English explanations ready for triage.`,
      cta: { label: 'Triage queue', href: '/procurement/exceptions' },
    })
  }

  // 4. Healthy state — show something positive
  if (built.length === 0) {
    built.push({
      id: 'healthy',
      severity: 'success',
      title: 'All clear — no critical signals',
      detail: 'No expiring batches, no pending recommendations, no open exceptions. Network is healthy.',
    })
  }

  return built
}
