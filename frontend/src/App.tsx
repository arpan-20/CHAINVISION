import { Navigate, Route, Routes } from 'react-router-dom'

import PlannerHome from './pages/planner/PlannerHome'
import PlannerLayout from './pages/planner/PlannerLayout'
import InventoryView from './pages/planner/InventoryView'
import ExpiryHeatmap from './pages/planner/ExpiryHeatmap'
import RecommendationsView from './pages/planner/RecommendationsView'
import DemandSignalsView from './pages/planner/DemandSignalsView'
import ProcurementHome from './pages/procurement/ProcurementHome'
import ProcurementLayout from './pages/procurement/ProcurementLayout'
import RequisitionsView from './pages/procurement/RequisitionsView'
import PurchaseOrdersView from './pages/procurement/PurchaseOrdersView'
import GoodsReceiptView from './pages/procurement/GoodsReceiptView'
import InvoiceUploadView from './pages/procurement/InvoiceUploadView'
import ExceptionQueueView from './pages/procurement/ExceptionQueueView'
import P2pAnalyticsView from './pages/procurement/P2pAnalyticsView'

function Placeholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        CHAINVISION - under construction
      </h1>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/planner" element={<PlannerLayout />}>
        <Route index element={<PlannerHome />} />
        <Route path="inventory" element={<InventoryView />} />
        <Route path="expiry-risk" element={<ExpiryHeatmap />} />
        <Route path="replenishment" element={<RecommendationsView />} />
        <Route path="demand-signals" element={<DemandSignalsView />} />
      </Route>
      <Route path="/procurement" element={<ProcurementLayout />}>
        <Route index element={<ProcurementHome />} />
        <Route path="requisitions" element={<RequisitionsView />} />
        <Route path="purchase-orders" element={<PurchaseOrdersView />} />
        <Route path="goods-receipt" element={<GoodsReceiptView />} />
        <Route path="invoices" element={<InvoiceUploadView />} />
        <Route path="exceptions" element={<ExceptionQueueView />} />
        <Route path="analytics" element={<P2pAnalyticsView />} />
      </Route>
      <Route path="/" element={<Navigate to="/planner" replace />} />
      <Route path="*" element={<Navigate to="/planner" replace />} />
    </Routes>
  )
}

export default App