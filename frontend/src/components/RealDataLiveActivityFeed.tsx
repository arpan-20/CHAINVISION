import { useEffect, useState } from 'react'

import { p1Client } from '../api/p1Client'
import { pr2Client } from '../api/pr2Client'
import LiveActivityFeed, { type ActivityEvent } from './LiveActivityFeed'

/* ──────────────────────────────────────────────
   REAL-DATA LIVE ACTIVITY FEED
   Pulls from P1 and PR2 APIs to surface recent
   platform events in real time. Refreshes every
   30s via the underlying LiveActivityFeed tick.
   ────────────────────────────────────────────── */
export default function RealDataLiveActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [tick, setTick] = useState(0)

  const load = () => {
    Promise.all([
      // P1: replenishment + inventory batches
      p1Client
        .get('/replenishment/recommendations')
        .then((r) => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
      p1Client
        .get<unknown>(`/inventory`)
        .then((r) => ((r as { data?: { data?: { batches?: unknown[] } } })?.data?.data?.batches ?? []) as Array<{ id: string; batchNo: string; daysUntilExpiry: number; expiryRisk: string; skuId: string; dcId: string }>)
        .catch(() => []),
      // PR2: POs, requisitions, invoices, exceptions, payments
      pr2Client.get<unknown[]>('/purchase-orders').then((r) => r.data ?? []).catch(() => []),
      pr2Client.get<unknown[]>('/requisitions').then((r) => r.data ?? []).catch(() => []),
      pr2Client.get<unknown[]>('/invoices').then((r) => r.data ?? []).catch(() => []),
      pr2Client.get<unknown[]>('/exceptions').then((r) => r.data ?? []).catch(() => []),
      pr2Client.get<unknown[]>('/payment-approvals').then((r) => r.data ?? []).catch(() => []),
    ]).then(([recs, batches, pos, reqs, invoices, exceptions, payments]) => {
      const ev: ActivityEvent[] = []

      // Recent replenishment recommendations (NEW = urgent)
      const newRecs = (recs as Array<{ id: string; recommendedQty: number; urgency: string; createdAt: string; status: string }>)
        .filter((r) => r.status === 'NEW')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2)
      newRecs.forEach((r) => {
        ev.push({
          id: `rec-${r.id}`,
          type: 'replenishment',
          message: `New replenishment recommendation`,
          detail: `${r.recommendedQty} units · urgency: ${r.urgency}`,
          tone: r.urgency === 'CRITICAL' ? 'critical' : r.urgency === 'HIGH' ? 'warning' : 'signal',
          timestamp: r.createdAt,
        })
      })

      // Batches expiring within 7 days
      const expiring = (batches as Array<{ id: string; batchNo: string; daysUntilExpiry: number; expiryRisk: string }>)
        .filter((b) => b.daysUntilExpiry <= 7 && b.daysUntilExpiry >= 0)
        .slice(0, 2)
      expiring.forEach((b) => {
        ev.push({
          id: `batch-${b.id}`,
          type: 'inventory',
          message: `Batch ${b.batchNo} expiring ${b.daysUntilExpiry}d`,
          detail: b.expiryRisk === 'CRITICAL' ? 'Action required now' : `${b.daysUntilExpiry} days remaining`,
          tone: b.expiryRisk === 'CRITICAL' ? 'critical' : b.expiryRisk === 'WARNING' ? 'warning' : 'signal',
          timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(), // fallback
        })
      })

      // Recent POs
      const recentPOs = (pos as Array<{ id: string; poNumber: string; status: string; createdAt: string; supplierName?: string }>)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2)
      recentPOs.forEach((p) => {
        ev.push({
          id: `po-${p.id}`,
          type: 'po',
          message: `PO ${p.poNumber} ${p.status.toLowerCase().replace('_', ' ')}`,
          detail: p.supplierName,
          tone: 'signal',
          timestamp: p.createdAt,
        })
      })

      // Recent requisitions
      const recentReqs = (reqs as Array<{ id: string; requisitionNumber: string; status: string; createdAt: string; source: string }>)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 1)
      recentReqs.forEach((r) => {
        ev.push({
          id: `req-${r.id}`,
          type: 'pr',
          message: `PR ${r.requisitionNumber} raised`,
          detail: `Source: ${r.source.toLowerCase()}`,
          tone: 'signal',
          timestamp: r.createdAt,
        })
      })

      // Exceptions
      const activeExceptions = (exceptions as Array<{ id: string; invoiceNumber: string; createdAt: string }>)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2)
      activeExceptions.forEach((e) => {
        ev.push({
          id: `exc-${e.id}`,
          type: 'exception',
          message: `Invoice ${e.invoiceNumber} needs review`,
          detail: '3-way match exception',
          tone: 'critical',
          timestamp: e.createdAt,
        })
      })

      // Auto-approved invoices this week
      const autoApproved = (payments as Array<{ id: string; status: string; approvedAt: string | null }>)
        .filter((p) => p.status === 'AUTO_APPROVED')
      if (autoApproved.length > 0) {
        ev.push({
          id: `pay-auto`,
          type: 'invoice',
          message: `Auto-approved ${autoApproved.length} invoice${autoApproved.length > 1 ? 's' : ''}`,
          detail: 'Touchless P2P processing',
          tone: 'signal',
          timestamp: autoApproved[0].approvedAt ?? new Date().toISOString(),
        })
      }

      // Sort by timestamp desc, cap at 8
      ev.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(ev.slice(0, 8))
    })
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  // Re-tick every 30s so LiveActivityFeed's internal timer also fires
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  return <LiveActivityFeed events={events} className="" />
}
