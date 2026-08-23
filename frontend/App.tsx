import { Routes, Route } from 'react-router-dom'

// Placeholder stub for Phase 1 scaffold. Real routes (Planner Dashboard,
// Procurement Dashboard, auth) land in later phases (see Section 12, 9, 19
// of 00_PROJECT_CONTEXT.md) — react-router-dom is wired up and ready.
function Placeholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">
          MedCare Pharma / CHAINVISION
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          CHAINVISION — under construction
        </h1>
        <p className="mt-4 text-slate-400">
          Demand sensing, replenishment planning, and procure-to-pay — wired together.
        </p>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  )
}

export default App
