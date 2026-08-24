import { Route, Routes } from 'react-router-dom'

function Placeholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        CHAINVISION - under construction
      </h1>
    </main>
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
