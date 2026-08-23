import 'dotenv/config'
import express from 'express'
import cors from 'cors'

// CHAINVISION — P1 backend (Demand Sensing & Replenishment Planning)
// Bootstrap only. Business routes (skus, inventory, demand-signals,
// replenishment) land in later phases — see Section 13.1 of
// 00_PROJECT_CONTEXT.md. DB access goes through @supabase/supabase-js
// (Supabase-hosted Postgres), no ORM.

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

const PORT = process.env.P1_PORT ? Number(process.env.P1_PORT) : 4000

app.listen(PORT, () => {
  console.log(`[p1-backend] listening on port ${PORT}`)
})
