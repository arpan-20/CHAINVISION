import express from 'express'
import cors from 'cors'

import { env } from './config/env'
import './db/supabaseClient'
import { errorHandler } from './middleware/errorHandler'
import { dcRoutes } from './routes/dcRoutes'
import { demandRoutes } from './routes/demandRoutes'
import { inventoryRoutes } from './routes/inventoryRoutes'
import { replenishmentRoutes } from './routes/replenishmentRoutes'
import { skuRoutes } from './routes/skuRoutes'

// CHAINVISION — P1 backend (Demand Sensing & Replenishment Planning)
// Bootstrap only. Business routes (skus, inventory, demand-signals,
// replenishment) land in later phases — see Section 13.1 of
// 00_PROJECT_CONTEXT.md. DB access goes through @supabase/supabase-js
// (Supabase-hosted Postgres), no ORM.

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/api', demandRoutes)
app.use('/api', skuRoutes)
app.use('/api', dcRoutes)
app.use('/api', inventoryRoutes)
app.use('/api', replenishmentRoutes)

app.use(errorHandler)

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.p1Port, () => {
    console.log(`[p1-backend] listening on port ${env.p1Port}`)
  })
}
