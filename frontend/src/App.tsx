import { Route, Routes } from 'react-router-dom'

import PlannerHome from './pages/planner/PlannerHome'
import PlannerLayout from './pages/planner/PlannerLayout'
import PlannerSectionPlaceholder from './pages/planner/PlannerSectionPlaceholder'
import InventoryView from './pages/planner/InventoryView'
import ExpiryHeatmap from './pages/planner/ExpiryHeatmap'
import RecommendationsView from './pages/planner/RecommendationsView'
import { PulseIcon } from './components/icons'

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
        <Route
          path="demand-signals"
          element={
            <PlannerSectionPlaceholder
              icon={PulseIcon}
              title="Demand Signals"
              description="Sensed demand against forecast, by region — including the flu-season spikes that trigger Tier-2 stockouts."
              comingIn={[
                'Historical and sensed demand by SKU/region',
                'Forecast vs. actual comparison',
                'Regional spike detection (e.g. flu-season demand)',
              ]}
            />
          }
        />
      </Route>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  )
}

export default App
