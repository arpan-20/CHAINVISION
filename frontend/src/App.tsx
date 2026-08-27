import { Navigate, Route, Routes } from 'react-router-dom'

import RequireRole from './components/RequireRole'
import { useAuth } from './hooks/useAuth'
import type { AuthRole } from './hooks/useAuth'
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
import LoginPage from './pages/LoginPage'

import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'

const homeForRole = (role: AuthRole | null) => {
  if (role === 'PROCUREMENT_OFFICER') return '/procurement'
  return '/planner'
}

function HomeRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mist">Checking session...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={homeForRole(role)} replace />
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/planner"
          element={
            <ErrorBoundary>
              <RequireRole roles={['PLANNER', 'ADMIN']}>
                <PlannerLayout />
              </RequireRole>
            </ErrorBoundary>
          }
        >
          <Route index element={<PlannerHome />} />
          <Route path="inventory" element={<InventoryView />} />
          <Route path="expiry-risk" element={<ExpiryHeatmap />} />
          <Route path="replenishment" element={<RecommendationsView />} />
          <Route path="demand-signals" element={<DemandSignalsView />} />
        </Route>
        <Route
          path="/procurement"
          element={
            <ErrorBoundary>
              <RequireRole roles={['PROCUREMENT_OFFICER', 'ADMIN']}>
                <ProcurementLayout />
              </RequireRole>
            </ErrorBoundary>
          }
        >
          <Route index element={<ProcurementHome />} />
          <Route path="requisitions" element={<RequisitionsView />} />
          <Route path="purchase-orders" element={<PurchaseOrdersView />} />
          <Route path="goods-receipt" element={<GoodsReceiptView />} />
          <Route path="invoices" element={<InvoiceUploadView />} />
          <Route path="exceptions" element={<ExceptionQueueView />} />
          <Route path="analytics" element={<P2pAnalyticsView />} />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      <ToastContainer />
    </>
  )
}

export default App
