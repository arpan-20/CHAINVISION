# CHAINVISION — Project Overview

**The single document a teammate reads to understand the whole project, end to end.**

---

## 0. Who this is for

You just joined the CHAINVISION team (or you're a judge, a future maintainer, or a hackathon evaluator trying to understand what we built in 5 days). You have ~30 minutes.

**Read this file top to bottom.** By the end you will know:

1. What problem CHAINVISION solves, who it serves, and why one integrated platform instead of two demos.
2. How data flows through the system from a demand signal to a paid invoice.
3. Which services exist, which languages they use, which databases they touch, and how they talk to each other.
4. What every top-level folder in the repo is for, what the most important files inside it are, and where to start reading.
5. Which non-negotiable design rules govern the codebase and why.
6. How to run it locally, how to demo it, and how to test it.

**You do not need to read anything else to be effective.** Every other document in the repo is a deeper dive into one specific area and is referenced from here.

---

## 1. What CHAINVISION is, in one paragraph

CHAINVISION is an **integrated supply chain platform** built for pharma distributors that connects two usually-separate systems into one continuous, mostly-touchless pipeline:

- **P1 — Demand Sensing & Replenishment Planning** watches demand, inventory, and batch-level expiry data, and decides *what* needs to be reordered, *how much*, and *how urgently*.
- **PR2 — Autonomous Procure-to-Pay (P2P)** takes that replenishment decision and runs the entire purchasing lifecycle — requisition, supplier scoring, PO, goods receipt, invoice OCR, three-way match, payment approval — with a human in the loop only when the math says something is wrong.

The two halves are connected by a single, minimal **handoff contract** (`Replenishment Recommendation` JSON object) that P1 emits and PR2 consumes. A stockout detected at 09:00 produces a paid invoice by 09:05 with zero human keystrokes — except when a deterministic 3-way match fails, at which point a procurement officer is asked to resolve a specific exception with an AI-generated plain-English explanation of what went wrong.

The demo persona is **MedCare Pharma**, a multi-DC Indian pharma distributor facing flu-season +60% demand spikes in Tier-2 cities while Tier-1 metros sit on near-expiry stock. Both sides of that problem are the same problem, and CHAINVISION is the system that solves it as one.

---

## 2. The problem the system solves

**MedCare Pharma is fighting two wars on opposite fronts.**

| Front | Problem | Symptom |
|---|---|---|
| Tier-2 cities | Flu-season demand spikes +60% within 72 hours | Stockouts of critical SKUs, lost sales, patient impact |
| Tier-1 metros | Large inventory positions at metro DCs | Near-expiry stock becomes write-offs, wasted working capital |

These are the same problem seen from two cities: *the wrong inventory is in the wrong place.* The systems that see them — demand planning in one silo, procurement in another — don't talk to each other. Between the two, a planner raises a flag, a procurement officer eventually creates a PR, a supplier is chosen by hand, a PO is emailed, goods are received against a paper DC, an invoice arrives as a PDF and is keyed in by an AP clerk, and only then does a finance approver run a 3-way match that sometimes fails. **Days pass, and either someone has gone without medicine or a batch has expired on a shelf.**

CHAINVISION collapses that gap into a deterministic, AI-assisted, mostly-touchless pipeline. The math (demand, safety stock, ROP, EOQ, FEFO, expiry risk, supplier scoring, 3-way match) is plain code. The natural-language pieces (intent extraction, rationale text, invoice OCR, mismatch explanation) are scoped AI calls. The two halves integrate at one clean boundary.

---

## 3. The 5-minute system walkthrough

This is the narrative. By the end of this section you should be able to draw the system diagram from memory.

### 3.1 The 09:00 to 09:05 story

> **09:00** — P1's deterministic engine sees a Tier-2 demand spike for *Paracetamol 500mg* at the Pune DC. Current stock covers 2.3 days; the reorder point (420) is breached.
>
> **09:00:30** — The four engines run: `demandEngine` (apply the +60% sensed adjustment), `replenishmentMathEngine` (compute safety stock, ROP, EOQ), `fefoEngine` (sequence the existing batches by expiry), `expiryRiskEngine` (score the at-risk batches). Output: a `Replenishment Recommendation` with `recommendedQty=500`, `urgency=HIGH`, `reason=BELOW_ROP`, plus an **AI-generated one-paragraph rationale** that the deterministic engine just computed the numbers for.
>
> **09:01** — `services/pr2ClientService.ts` POSTs the recommendation to PR2's `/api/requisitions/from-recommendation`. PR2's requisition controller creates a `purchase_requisitions` row with `source = SYSTEM`. Socket.IO pushes a `requisition_created` event to connected dashboards.
>
> **09:01:30** — `service/SupplierService.java` runs deterministic weighted scoring over 8 suppliers on price, lead time, OTD, quality, and capacity. The best fit wins. A `purchase_orders` row is created and `status` moves to `ISSUED`.
>
> **09:02** — A user clicks **Simulate goods receipt**. A `goods_receipts` row appears with `batch_no`, `received_qty`, and `expiry_date`.
>
> **09:02:30** — The user uploads an invoice PDF. `OcrService.java` calls P1's `/internal/ocr/extract` proxy, which uses Gemini multimodal (primary) or Tesseract.js (fallback) to extract `invoice_number`, `po_number`, line items, total, vendor. The result is persisted as `invoices.raw_ocr_json` (jsonb).
>
> **09:03** — `MatchingService.java` runs the 3-way match: PO quantity and price vs. GRN received quantity and price vs. OCR'd invoice quantity and price, with configurable tolerance. Result: `MATCHED` or `MISMATCHED`. If matched, a `payment_approvals` row is set to `AUTO_APPROVED` and Socket.IO pushes `payment_status_changed`. If mismatched, the invoice lands in the **Exception Queue** with `ai_explanation` populated by Gemini from the deterministic mismatch details.
>
> **09:05** — The P2P analytics dashboard's touchless % ticks up. The loop is closed.

A human has touched *zero* fields. The only place a human appears is when the math says something is wrong.

### 3.2 The system diagram

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                  React 18 + Vite + TypeScript + Tailwind                 │
 │                                                                          │
 │   Planner Dashboard                          Procurement Dashboard       │
 │   ─ Inventory                                ─ Requisitions              │
 │   ─ Expiry Heatmap                           ─ Purchase Orders           │
 │   ─ Replenishment Recommendations            ─ Goods Receipts            │
 │   ─ Demand Signals                           ─ Invoice Upload (OCR)      │
 │   ─ AI Insight Banner                        ─ Exception Queue           │
 │   ─ Supply-Network 3D View                   ─ P2P Analytics             │
 │   ─ Socket.IO client (realtime)              ─ Supplier Scorecards       │
 │                                             ─ NL Requisition Chatbot    │
 └──────────────────┬───────────────────────────────────┬────────────────────┘
                    │ REST + JWT (role-gated)          │ REST + JWT
                    ▼                                   ▼
 ┌──────────────────────────────┐         ┌──────────────────────────────────┐
 │   P1 Backend (Node/Express)  │         │  PR2 Backend (Java 17 / Spring)  │
 │                              │  POST   │                                  │
 │   ─ Deterministic engines    │────────▶│   ─ Requisition                  │
 │   ─ Recommendation service   │ handoff │   ─ Sourcing (weighted scoring)  │
 │   ─ Gemini rationale svc     │         │   ─ Purchase Order               │
 │   ─ Socket.IO realtime hub ◀─│─webhook─│   ─ Goods Receipt                │
 │   ─ JWT issue + verify       │         │   ─ Invoice OCR (Gemini)         │
 │   ─ Tesseract.js OCR fallback│         │   ─ Three-Way Match (deterministic)│
 │                              │         │   ─ Exception handling           │
 │                              │         │   ─ Payment approval             │
 │                              │         │   ─ JWT verify (Spring Security) │
 └──────────────┬───────────────┘         └────────────────┬─────────────────┘
                │                                            │
                ▼                                            ▼
       ┌──────────────────────────────────────────────────────────────┐
       │             Supabase Postgres (single instance)              │
       │             schema `p1`         │        schema `pr2`         │
       └──────────────────────────────────────────────────────────────┘
                                     ▲
                                     │  shared JWT secret
                  ┌──────────────────┴───────────────────┐
                  │      Google Gemini API (free tier)     │
                  │   ─ Rationale text                     │
                  │   ─ NL intent extraction               │
                  │   ─ Multimodal invoice OCR             │
                  │   ─ Mismatch explanations              │
                  └────────────────────────────────────────┘
```

Three independently deployable services (frontend, P1 backend, PR2 backend) share one Postgres instance with two logical schemas. The two backends are *physically independent* — they don't import each other's code, they don't share a database connection, they don't run in the same process. They communicate only over HTTP, and the one document that defines that contract lives in `shared/contracts/replenishmentRecommendation.schema.json`.

The single realtime hub is hosted in the P1 Node backend. PR2 does not run its own WebSocket server; instead, whenever its state changes, it makes an authenticated `POST /internal/realtime/emit` call to P1, which fans the event out over Socket.IO to all connected dashboards. This keeps Spring Boot free of WebSocket code and concentrates realtime concerns in one place.

---

## 4. The non-negotiable design rules

There are five rules that govern the codebase. Violating any of them is a bug. Every code review checks for these.

### 4.1 AI never computes business numbers

**AI/LLM APIs must NEVER perform core numeric or business calculations.** Demand sensing, safety stock, reorder point, EOQ, FEFO sequencing, expiry risk scoring, supplier weighting, and three-way match are all plain deterministic code — pure functions, unit-tested, reproducible. The same input produces the same output every time, with no LLM non-determinism in the numeric path.

AI (Google Gemini, free tier) is used **only** for:

1. **NL requisition intent extraction** (PR2 chatbot) — turning free text like *"We need 300 units of Amoxicillin for Pune, urgent"* into structured JSON `{ skuGuess, quantity, dcGuess, urgency, confidence }`.
2. **P1 rationale generation** — phrasing a one-paragraph explanation of a recommendation whose numbers are already computed.
3. **PR2 mismatch explanation** — phrasing a one-paragraph explanation of a 3-way match failure whose details are already known.
4. **Invoice document extraction** (OCR) — pulling structured fields out of a PDF/image.

Every Gemini call that *describes* a result receives the final computed numbers as input variables. Gemini is only ever asked to *describe*, never to *derive*.

### 4.2 No cross-schema foreign keys

`p1` and `pr2` are two logical schemas in one Supabase Postgres instance. They are owned by independently deployable services. Cross-schema references — e.g. `pr2.purchase_requisitions.recommendation_id` pointing to `p1.replenishment_recommendations.id` — are stored as plain UUID/text columns, **not** enforced foreign keys. This lets either service be moved, scaled, or replaced without touching the other.

### 4.3 P1 and PR2 stay independently deployable

You can stop PR2, take P1 down to v0.2, and bring it back up — without touching PR2. You can replace PR2 with a Python rewrite, a different vendor's system, or a manual queue — and P1 will keep working as long as the handoff contract is honored. The contract in `shared/contracts/` is the only thing both services must agree on.

### 4.4 The realtime hub lives in P1

Socket.IO is hosted inside the P1 Node backend. PR2 (Spring Boot) avoids native WebSocket implementation by POSTing state-change events to `POST /internal/realtime/emit` on P1, which fans them out to connected dashboards. This was a deliberate trade — P1 already hosts the hub for its own low-stock events, so consolidating realtime in one place saves implementation time and reduces moving parts.

### 4.5 Everything deterministic must be unit-tested

Every deterministic engine (`demandEngine`, `replenishmentMathEngine`, `fefoEngine`, `expiryRiskEngine`, `SupplierService`, `MatchingService`) ships with a sibling test file using Vitest or JUnit. AI services are tested against mocked Gemini clients. The 10-step e2e integration test in `scripts/e2e_smoke_test.ts` is gated as a manual `workflow_dispatch` in CI because it needs live Supabase + a Gemini key.

---

## 5. The two services, side by side

| | **P1 — Demand Sensing & Replenishment** | **PR2 — Autonomous Procure-to-Pay** |
|---|---|---|
| **Owns** | What to reorder, how much, how urgently | How to buy it, who from, and whether the invoice matches |
| **Inputs** | Historical demand, sensed demand signals, batch-level inventory with expiry, DC capacity and lead time | P1 recommendations, chatbot NL requests, manual entries |
| **Deterministic engines** | `demandEngine`, `replenishmentMathEngine` (safety stock, ROP, EOQ), `fefoEngine`, `expiryRiskEngine` | `SupplierService` (weighted scoring), `MatchingService` (3-way match with tolerance) |
| **AI use** | Plain-English rationale for a recommendation whose numbers are already computed | NL intent extraction, invoice OCR (PDF/image), mismatch explanation |
| **Outputs** | Replenishment Recommendation (qty, urgency, reason code, AI rationale) | Auto-PO, GRN, auto-matched invoice, auto-approved payment — or Exception Queue entry |
| **Stack** | Node 20 + Express 4 + TypeScript | Java 17 + Spring Boot 3.3 (Maven) |
| **Port** | 4000 | 8080 |
| **DB schema** | `p1` (Postgres, Supabase) | `pr2` (Postgres, Supabase) |
| **Why this stack** | JSON-heavy deterministic calc services, fast REST, same language family as frontend | **Mandated by team skill profile**; batteries-included REST, JPA, Security |

The stack split is deliberate and non-negotiable. PR2 in Java was a team constraint; P1 in Node was a "fast zero-to-demo" choice that pairs well with the frontend. Each service uses the language and framework that fits its constraints.

---

## 6. The P1 backend in detail

**Node 20 + Express 4 + TypeScript, port 4000. Source under `p1-backend/`.**

### 6.1 The four deterministic engines

These are the heart of P1. Each is a pure function over its inputs, fully unit-tested, with no AI calls in the code path.

- **`engine/demandEngine.ts`** — groups historical demand by SKU+DC, applies `sensed_adjustment_pct` (e.g. +60% for flu season), returns adjusted demand.
- **`engine/replenishmentMathEngine.ts`** — given demand statistics and lead time, computes safety stock, reorder point (ROP), and EOQ.
- **`engine/fefoEngine.ts`** — first-expiry-first-out batch sequencing. Sorts inventory batches by expiry date and returns the picking order so the oldest stock moves first.
- **`engine/expiryRiskEngine.ts`** — converts days-to-expiry into a weighted risk score used for color coding the inventory table and the expiry heatmap.

Each engine ships with a sibling `*.test.ts` using Vitest fixtures, asserting that the same input produces the same output, and that known edge cases (zero demand, zero lead time, past-expiry batches) are handled.

### 6.2 The service layer

`services/` orchestrates the engines and talks to Supabase, Gemini, and PR2.

- **`recommendationService.ts`** — pulls the four engines together for one SKU+DC pair, assigns urgency (`LOW | MEDIUM | HIGH | CRITICAL`), and persists a `replenishment_recommendations` row. **The core service of P1.**
- **`aiRationaleService.ts`** — calls Gemini with the *already-computed* numbers and asks for a one-paragraph plain-English explanation. The output is stored in `replenishment_recommendations.ai_rationale` and surfaced on the dashboard. **Never** used to compute a quantity.
- **`pr2ClientService.ts`** — POSTs new recommendations to `PR2_BASE_URL/api/requisitions/from-recommendation`. Logs and swallows non-fatal errors so a PR2 outage doesn't block the engine from running.
- **`inventoryService.ts`**, **`demandService.ts`** — thin wrappers over the Supabase client for CRUD on inventory batches and demand signals.
- **`ocrService.ts`** — invoice OCR. Tries Gemini multimodal first (PDF/image inline data); falls back to Tesseract.js on the rasterized page if Gemini fails or the free tier is rate-limited. Returns a structured payload that the PR2 invoice service expects.
- **`geminiClient.ts`** — central wrapper around `@google/generative-ai` so every Gemini call goes through one place (and is easy to mock in tests).

### 6.3 The routes layer

`routes/` is the HTTP surface, all mounted under `/api`:

- `skuRoutes.ts` — `GET /api/skus`
- `dcRoutes.ts` — `GET /api/distribution-centers`
- `inventoryRoutes.ts` — `GET /api/inventory` (filterable by sku/dc), batch CRUD
- `demandRoutes.ts` — `GET/POST /api/demand-signals`
- `replenishmentRoutes.ts` — `GET /api/replenishment/recommendations` (filterable by urgency/status), `POST /api/replenishment/recalculate` (triggers the engine), `GET /api/replenishment/recommendations/:id`
- `internalOcrRoutes.ts` — `POST /internal/ocr/extract`, the proxy that PR2 calls. Mounted unprefixed at the root.

### 6.4 The realtime hub

`realtime/` hosts the **single Socket.IO server for the whole system**. PR2 does not run its own WebSocket server; it POSTs to `POST /internal/realtime/emit` on P1, which fans the event out to connected dashboards.

Events emitted: `low_stock_alert`, `replenishment_recommendation_created`, `requisition_created`, `po_issued`, `invoice_uploaded`, `three_way_match_result`, `payment_status_changed`.

If Socket.IO is unavailable, both dashboards fall back to 5–10 second polling on list endpoints. This is flagged in code as a `TODO` fallback, not the primary design.

### 6.5 Auth

`auth/` issues and verifies HS256 JWTs. `POST /api/auth/login` and `POST /api/auth/register` are the entry points. The token is signed with `JWT_SECRET` and the same secret is used by PR2 to verify — so a token issued by P1 is valid on PR2's protected routes.

---

## 7. The PR2 backend in detail

**Java 17 + Spring Boot 3.3, port 8080. Source under `pr2-backend/src/main/java/com/chainvision/pr2/`.**

### 7.1 The package layout

One package per P2P stage, plus cross-cutting concerns:

- `Pr2Application.java` — Spring Boot entry point.
- `controller/AnalyticsController.java` — `GET /api/analytics/p2p-summary`.
- `service/` — top-level services that don't fit a single stage:
  - **`MatchingService.java`** — the deterministic 3-way match engine. Compares PO quantity/price against GRN and OCR'd invoice values, applies tolerance rules, writes a `three_way_matches` row.
  - **`SupplierService.java`** — the deterministic supplier scoring service. Weighted score over price, lead time, OTD, quality, and capacity. No LLM in the scoring.
  - `AnalyticsService.java` — touchless %, cycle time, exception rate aggregations.
- `requisition/` — Requisition stage. `controller` exposes the P1 handoff endpoint. `entity` is the JPA-mapped `PurchaseRequisition` with `source` enum (SYSTEM / CHATBOT / MANUAL) and nullable `recommendation_id` link to P1.
- `sourcing/` — supplier evaluation. Calls `SupplierService`, persists the chosen supplier on the requisition.
- `purchaseorder/` — PO stage. Auto-creates a `PurchaseOrder` from a sourced requisition, sets `unit_price` and `total_amount` from the supplier's price index × quantity, transitions the status enum (ISSUED → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → CLOSED).
- `goodsreceipt/` — GRN stage. `POST /api/goods-receipts` simulates receipt against a PO; captures `batch_no`, `received_qty`, and `expiry_date` for downstream 3-way match.
- `invoice/` — invoicing + OCR + match. `OcrService.java` calls out to P1's `/internal/ocr/extract` proxy. Persists extracted fields as `raw_ocr_json` (jsonb). `service` runs the match by delegating to top-level `MatchingService`.
- `exception/` — exception queue. `GET /api/exceptions` lists mismatched invoices; `POST /api/exceptions/{id}/resolve` accepts manual approve/reject.
- `payment/` — payment approval. Sets `payment_approvals.status` to `AUTO_APPROVED` on match-success, `PENDING_REVIEW` on match-failure.
- `ai/` — Gemini client wrapper for any PR2-side AI calls (currently minimal).
- `security/` — Spring Security config: JWT verification using the shared `JWT_SECRET`, role-based access on routes.
- `dto/` — request/response DTOs. **The most important one is `ReplenishmentRecommendationDto`, which mirrors `shared/contracts/replenishmentRecommendation.schema.json`** — this is the Java shape that validates the P1 handoff payload.
- `entity/` — JPA entities (one per table in schema `pr2`).
- `repository/` — Spring Data JPA repository interfaces.
- `config/` — CORS, security, OpenAPI/Swagger.

### 7.2 Application config

`src/main/resources/application.yml` configures the Spring app: server port, datasource (with `currentSchema=pr2&sslmode=require` for Supabase), JPA settings (`ddl-auto`, `properties.hibernate.dialect=PostgreSQLDialect`), JWT secret, P1 base URL, P1 OCR URL, P1 realtime URL, internal API key, Gemini API key, CORS allowed origins.

---

## 8. The handoff contract

When P1's engine determines an SKU/DC combination requires replenishment, it emits a `Replenishment Recommendation`. PR2's `POST /api/requisitions/from-recommendation` consumes the same object and creates a system-sourced `purchase_requisitions` row.

**The contract (see `shared/contracts/replenishmentRecommendation.schema.json` for the authoritative JSON Schema):**

```jsonc
{
  "recommendationId": "rec_abc123",      // p1.replenishment_recommendations.id
  "skuId":            "sku_paracetamol_500",
  "skuName":          "Paracetamol 500mg",
  "dcId":             "dc_pune",
  "recommendedQty":   500,                // computed by EOQ; never by AI
  "urgency":          "HIGH",             // LOW | MEDIUM | HIGH | CRITICAL
  "reason":           "BELOW_ROP",        // deterministic reason code
  "aiRationale":      "Recommending 500 units for Pune DC:    // one-paragraph Gemini rationale
                      current stock covers 2.3 days against
                      a +60% sensed demand spike, ROP (420)
                      breached.",
  "expiryRiskContext": "BATCH-A expiring in 12d",
  "generatedAt":      "2026-08-28T03:30:00Z"
}
```

**The contract deliberately contains no supplier, PO, invoice, or payment fields.** Those decisions stay inside PR2 after the handoff. This minimalism is what makes the integration resilient — adding a field requires coordinated changes in the schema, the P1 emitter, the PR2 DTO, the PR2 validator, and the PR2 consumer; if you don't need to, don't.

**Cross-schema identity:** `recommendationId` is the same UUID stored in `p1.replenishment_recommendations.id` and then copied into `pr2.purchase_requisitions.recommendation_id` as a plain text column. No enforced FK — see design rule 4.2.

---

## 9. The frontend in detail

**React 18 + Vite + TypeScript + Tailwind + Recharts, port 5173. Source under `frontend/`.**

The app has two role-gated dashboards that share a common `NavBar`, theme tokens, and API clients:

- **Planner dashboard** at `/planner` (PLANNER + ADMIN) — inventory, expiry heatmap, replenishment recommendations, demand signals, demand-spike simulator, AI insight banner, supply-network 3D view.
- **Procurement dashboard** at `/procurement` (PROCUREMENT_OFFICER + ADMIN) — requisitions, purchase orders, goods receipts, invoice upload with OCR, exception queue, P2P analytics, supplier scorecards, NL requisition chatbot.

### 9.1 The route table

`App.tsx` is the single source of truth for which role sees which page. It mounts `<RequireRole>` guards on each route, renders the global `<ErrorBoundary>` and `<ToastContainer>`, and uses `<Navigate>` to route the user to the right dashboard on login.

### 9.2 The pages

**Planner dashboard** (`src/pages/planner/`):

- `PlannerLayout.tsx` — shared shell with the planner-specific nav.
- `PlannerHome.tsx` — at-a-glance view: low-stock alerts, recent recommendations, AI insight banner, network status.
- `InventoryView.tsx` — batch-level inventory table, filterable by SKU and DC, with expiry risk highlighting.
- `ExpiryHeatmap.tsx` — SKU × DC heatmap where each cell is colored by expiry-risk score.
- `RecommendationsView.tsx` — list of replenishment recommendations with status, urgency, and the AI rationale expanded inline.
- `DemandSignalsView.tsx` — historical and sensed demand signals; supports filtering and CSV export.
- `DemandSpikeSimulator.tsx` — control panel to inject a synthetic demand spike for a tier-2 SKU and watch the deterministic engine recompute in realtime. This is the demo's centerpiece — clicking "Spike" triggers a new recommendation end-to-end.

**Procurement dashboard** (`src/pages/procurement/`):

- `ProcurementLayout.tsx` — shared shell.
- `ProcurementHome.tsx` — P2P summary tiles (touchless %, cycle time, exception rate), open exception count, recent activity.
- `RequisitionsView.tsx` — list + detail view; supports filtering by `source` (SYSTEM / CHATBOT / MANUAL) and `status`.
- `PurchaseOrdersView.tsx` — PO list with status transitions.
- `GoodsReceiptView.tsx` — simulate receipt against an issued PO; captures batch number and expiry date.
- `InvoiceUploadView.tsx` — multipart upload to PR2; shows OCR-extracted fields and the resulting match outcome.
- `ExceptionQueueView.tsx` — invoices in MISMATCHED / EXCEPTION state with the AI-generated explanation; manual approve / reject.
- `P2pAnalyticsView.tsx` — funnel and time-series charts covering touchless %, cycle time, exception rate.
- `SupplierScorecardPage.tsx` — per-supplier weighted-score breakdown (price · lead time · OTD · quality · capacity).
- `NlRequisitionChatbot.tsx` — free-text input that calls `POST /api/requisitions/parse-intent` (Gemini), pre-fills a requisition form, and submits on confirm.

**Login** (`src/pages/LoginPage.tsx`) — email + password sign-in. Calls Supabase Auth directly via the anon client, then hydrates the auth store.

### 9.3 Shared components

`src/components/`:
- `NavBar.tsx`, `RequireRole.tsx` — routing shell and role guard.
- `AiInsightBanner.tsx` / `RealDataAiInsightBanner.tsx` — Gemini-rationale callout.
- `LiveActivityFeed.tsx` / `RealDataLiveActivityFeed.tsx` — Socket.IO-driven event stream.
- `SupplyNetwork3D.tsx` — react-three-fiber 3D visualization of SKUs flowing between DCs.
- `Toast.tsx`, `ErrorBoundary.tsx`, `icons.tsx`, `badges.tsx` — UI primitives.

### 9.4 Hooks and API clients

- `src/hooks/useAuth.ts` — Supabase session + role.
- `src/hooks/useSocket.ts` — Socket.IO client lifecycle.
- `src/api/p1Client.ts`, `src/api/pr2Client.ts` — the two axios instances.
- `src/api/apiInterceptor.ts` — attaches the JWT, handles 401 → redirect to login, surfaces error toasts.

### 9.5 Design system

The visual language lives in `tailwind.config.js` and `src/index.css`. Theme tokens (`--ink`, `--panel`, `--signal`, `--alert`, `--critical`, etc.) are CSS variables consumed by Tailwind utility classes. Fonts are Space Grotesk (display), Inter (body), IBM Plex Mono (numeric/code). **Theme changes belong here, not in per-page inline styles.**

---

## 10. The database

**One Supabase Postgres instance, two logical schemas.**

### 10.1 Schema `p1`

| Table | Purpose | Key columns |
|---|---|---|
| `skus` | SKU master | `sku_code`, `name`, `category`, `unit_cost`, `lead_time_days` |
| `distribution_centers` | DC master | `dc_code`, `region` (tier-1 / tier-2), `capacity_units` |
| `inventory_batches` | Batch-level stock with expiry | `sku_id`, `dc_id`, `batch_no`, `quantity`, `expiry_date`, `received_date` |
| `demand_signals` | Historical and sensed demand | `sku_id`, `dc_id`, `signal_date`, `historical_demand`, `sensed_adjustment_pct`, `source` |
| `replenishment_recommendations` | Output of P1 engine | `recommended_qty`, `reorder_point`, `safety_stock`, `eoq`, `urgency`, `reason_code`, `ai_rationale`, `status` |
| `users` | Shared auth table | `role` enum (PLANNER / PROCUREMENT_OFFICER / ADMIN) |

### 10.2 Schema `pr2`

| Table | Purpose | Key columns |
|---|---|---|
| `suppliers` | Supplier master | `price_index`, `avg_lead_time_days`, `otd_score`, `quality_score`, `capacity_units` |
| `purchase_requisitions` | PRs (system / chatbot / manual) | `recommendation_id` (nullable, link to P1), `source`, `status` |
| `purchase_orders` | POs | `requisition_id`, `supplier_id`, `quantity`, `unit_price`, `total_amount`, `status` |
| `goods_receipts` | GRNs | `po_id`, `received_qty`, `batch_no`, `expiry_date`, `received_at` |
| `invoices` | Invoices with OCR payloads | `po_id`, `invoice_number`, OCR'd fields, `raw_ocr_json` (jsonb), `status` |
| `three_way_matches` | Match results | `invoice_id`, `po_id`, `grn_id`, `qty_match`, `price_match`, `result`, `mismatch_reason`, `ai_explanation` |
| `payment_approvals` | Payment decisions | `invoice_id`, `status` (AUTO_APPROVED / PENDING_REVIEW / REJECTED / APPROVED_MANUAL) |

The handoff reference (`pr2.purchase_requisitions.recommendation_id` → `p1.replenishment_recommendations.id`) is a plain text column, not an enforced FK — see design rule 4.2.

### 10.3 Migrations

`infra/supabase/` contains the Supabase CLI migrations. Apply with:

```bash
supabase db push
# or, for local dev:
supabase start && supabase db reset
```

Migrations are timestamp-prefixed SQL files and run in order. The active database target is Supabase; the legacy `infra/postgres/` and `infra/postgress/` (typo preserved) folders are superseded but kept for git history.

---

## 11. AI responsibilities (Google Gemini)

**Model: `gemini-2.0-flash`, free tier, no billing account required.**

| # | Responsibility | Side | Input | Output |
|---|---|---|---|---|
| 1 | NL requisition intent extraction | PR2 chatbot | free-text user message | structured JSON `{ skuGuess, quantity, dcGuess, urgency, confidence }` |
| 2 | P1 rationale generation | P1 dashboard | already-computed numbers (qty, ROP, expiry) | one-paragraph plain-English explanation |
| 3 | Mismatch explanation | PR2 exception queue | deterministic mismatch details (which field, expected vs actual) | plain-English reason for the procurement officer |
| 4 | Invoice OCR / document extraction | PR2 invoicing | PDF/image (base64 inline or Files API) | structured JSON `{ invoiceNumber, poNumber, lineItems, total, vendor }` |

**Hard implementation rule:** every Gemini call for rationale/explanation receives the final computed numbers as input variables. Gemini is only ever asked to *describe*, never to *derive*.

**Free-tier caveats:**
- Rate limits (requests per minute, requests per day) apply. Design around them.
- Keep a cached fallback string ready for the rationale in case of rate-limit errors during live judging.
- For OCR, if Gemini document extraction proves unreliable for a given sample invoice format, fall back to Tesseract.js + regex/field-position parsing.

---

## 12. Authentication and roles

- **Mechanism:** email + password, JWT (HS256) issued on login by P1's `POST /api/auth/login`. The same `JWT_SECRET` is used by both backends.
- **Frontend storage:** in-memory + `localStorage` (acceptable for hackathon demo scope).
- **Roles:**

| Role | Sees | Can do |
|---|---|---|
| `PLANNER` | P1 dashboard | View inventory, view recommendations, view demand signals, run demand-spike simulator |
| `PROCUREMENT_OFFICER` | PR2 dashboard | Create requisitions, view POs, simulate goods receipts, upload invoices, view exception queue, manually resolve exceptions |
| `ADMIN` | Both | Everything, plus demo controls |

- **Enforcement:** route-level `<RequireRole>` on the frontend; Spring Security method-level checks on PR2. **Not** just hidden in the UI.
- **Out of scope:** SSO, OAuth, MFA, password reset flows. Not needed for a 5-day hackathon demo.

Seeded demo users (created by the seed scripts):

| Email | Password | Role |
|---|---|---|
| `planner@chainvision.test` | `demo1234` | `PLANNER` |
| `procurement@chainvision.test` | `demo1234` | `PROCUREMENT_OFFICER` |
| `admin@chainvision.test` | `demo1234` | `ADMIN` |

---

## 13. The realtime event catalog

The P1 Node backend hosts the single Socket.IO hub. PR2 makes an authenticated `POST /internal/realtime/emit` whenever its state changes; P1 fans the event out to connected dashboards.

| Event | Source | Payload |
|---|---|---|
| `low_stock_alert` | P1 engine | `sku, dc, currentQty, threshold` |
| `replenishment_recommendation_created` | P1 engine | full recommendation object |
| `requisition_created` | PR2 → webhook → P1 | requisition summary |
| `po_issued` | PR2 → webhook → P1 | PO summary |
| `invoice_uploaded` | PR2 → webhook → P1 | invoice id, status |
| `three_way_match_result` | PR2 → webhook → P1 | `MATCHED` / `MISMATCHED` + reason |
| `payment_status_changed` | PR2 → webhook → P1 | invoice id, new status |

The frontend subscribes via `useSocket()` and dispatches events into the relevant page's state. If Socket.IO is unavailable, the dashboards fall back to 5–10 second polling on the list endpoints.

---

## 14. Repository tour — every folder explained

### 14.1 `frontend/`

The user-facing product. Both dashboards in one Vite app. See section 9 for the full breakdown. **Read `App.tsx` first** to see the route table and role guards.

### 14.2 `p1-backend/`

The demand-sensing service. Node 20 + Express 4 + TypeScript on port 4000. See section 6 for the full breakdown. **Read `src/index.ts` first** to see the wiring, then `src/engine/replenishmentMathEngine.ts` to see the math, then `src/services/recommendationService.ts` to see the orchestration.

### 14.3 `pr2-backend/`

The procure-to-pay service. Java 17 + Spring Boot 3.3 on port 8080. See section 7 for the full breakdown. **Read `Pr2Application.java` first**, then `service/MatchingService.java` and `service/SupplierService.java` to see the two critical deterministic services, then `requisition/controller/*` to see the P1 handoff endpoint.

### 14.4 `shared/`

Cross-service artefacts.

- `contracts/replenishmentRecommendation.schema.json` — the P1 → PR2 handoff contract. **This file is the integration boundary.** If you change it, change both backends in the same PR.
- `contracts/README.md` — describes the contract and its scope rules.
- `seed-data/p1_seed.ts` + `p1_seed_data.json` — seeds the `p1` schema with ~15–20 SKUs, 4–6 DCs, 90 days of demand, a +60% seasonal spike, near-expiry and below-ROP examples.
- `seed-data/pr2_seed.ts` + `pr2_seed_data.json` — seeds the `pr2` schema with 6–10 suppliers (including a "cheap but unreliable" and a "premium but high-performing" example), pre-existing POs and GRNs, sample invoice references.
- `seed-data/sample_invoices/` — PDF and JPG fixtures for the OCR demo (matching, qty-mismatch, price-mismatch).
- `seed-data/README_p1.md`, `README_pr2.md` — docs for the seed scripts.

### 14.5 `scripts/`

Operational and demo-test scripts.

- `e2e_smoke_test.ts` — the **primary integration test**. Walks the full 10-step demo flow against a live system. Run with `npm run e2e` from the repo root.
- `generate_sku_invoice_pdf.py` — synthesizes a fresh PDF invoice for any (SKU, supplier, qty) combination.
- `run-pr2.sh` — convenience wrapper for starting the PR2 backend.
- `README_smoke_test.md`, `README_invoice_demo.md` — docs for the above.

### 14.6 `infra/`

Infrastructure-as-code.

- `infra/supabase/` — **the active database target.** Supabase CLI migrations.
- `infra/postgres/` and `infra/postgress/` (typo preserved) — earlier local-Docker Postgres init scripts, superseded by Supabase, kept for git history. **Do not modify.**

### 14.7 `supabase/`

The Supabase project config that lives at the repo root (where the Supabase CLI expects it). Contains `config.toml` with project ID, API URL, auth providers, storage buckets, edge function settings. **Touch this folder when:** changing the Supabase project, adding auth providers, configuring storage buckets. **Do not** put SQL migrations here (those go in `infra/supabase/`).

### 14.8 `Documentaion/`

Documentation that isn't the README.

- `00_PROJECT_CONTEXT.md` — the **project bible**. Architecture, schema, build plan, 5-day roadmap, AI-scope rules, demo flow. Read this if you want depth on a specific area.
- `CHAINVISION_MASTER_CHECKLIST.md` — phase-by-phase task checklist with status.
- `PROMPTS.md` — archive of the AI dev prompts used to build the project.

### 14.9 `.github/`

GitHub-specific config. Contains `workflows/e2e-smoke-test.yml` — a manual `workflow_dispatch` workflow that runs the full e2e flow against a live system.

### 14.10 Repo-root files

- `docker-compose.yml` — builds `frontend`, `p1-backend`, `pr2-backend`. **Postgres is not in compose**; it points at Supabase.
- `.env.example` — annotated template of every env var. Copy to `.env` and fill in real values. **Never commit `.env`.**
- `package.json` — workspace-level scripts (`test:p1`, `test:pr2`, `e2e`) that dispatch into per-service package.json files.

---

## 15. Environment variables

All variables are loaded from the repo-root `.env`. The full annotated template is in `.env.example`.

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | yes | both backends, frontend | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | both backends, frontend | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | backends | Supabase service role (server-side) |
| `JWT_SECRET` | yes | both backends | Shared JWT signing secret — **must be identical in both backend envs** |
| `GEMINI_API_KEY` | yes | both backends | Google Gemini API key (free tier) |
| `GEMINI_MODEL` | no | both backends | Default `gemini-2.0-flash` |
| `P1_PORT` | no | p1-backend | Default `4000` |
| `PR2_PORT` | no | pr2-backend | Default `8080` |
| `PR2_BASE_URL` | yes | p1-backend | URL of PR2 for the handoff POST |
| `P1_BASE_URL` | yes | pr2-backend | URL of P1 for OCR proxy and realtime emit |
| `P1_OCR_URL` | yes | pr2-backend | P1 OCR proxy endpoint |
| `P1_REALTIME_URL` | yes | pr2-backend | P1 realtime emit endpoint |
| `INTERNAL_API_KEY` | yes | both backends | Shared key for internal service-to-service calls |
| `INTERNAL_REALTIME_KEY` | yes | both backends | Shared key for the realtime webhook |
| `SPRING_DATASOURCE_URL` | yes | pr2-backend | JDBC URL with `currentSchema=pr2&sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | yes | pr2-backend | Supabase DB credentials |
| `VITE_P1_API_BASE` | yes | frontend | Default `http://localhost:4000/api` |
| `VITE_PR2_API_BASE` | yes | frontend | Default `http://localhost:8080/api` |
| `VITE_SOCKET_URL` | yes | frontend | Default `http://localhost:4000` |
| `VITE_SUPABASE_URL` / `_ANON_KEY` | yes | frontend | Supabase auth config |

> `GEMINI_API_KEY` is read from the environment only. Never hardcode or commit it.

---

## 16. API reference

### 16.1 P1 backend — base `/api` (port 4000)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Issue JWT |
| `POST` | `/api/auth/register` | Create demo user |
| `GET` | `/api/skus` | List SKUs |
| `GET` | `/api/distribution-centers` | List DCs |
| `GET` | `/api/inventory` | Batch-level inventory (filter by sku/dc) |
| `POST` | `/api/demand-signals` | Ingest or simulate a demand signal |
| `GET` | `/api/demand-signals` | List demand signals |
| `GET` | `/api/replenishment/recommendations` | List recs (filter by urgency/status) |
| `POST` | `/api/replenishment/recalculate` | Trigger deterministic engine run |
| `GET` | `/api/replenishment/recommendations/:id` | Single recommendation |
| `POST` | `/internal/realtime/emit` | PR2 → P1 webhook (internal key) |
| `POST` | `/internal/ocr/extract` | PR2 → P1 OCR proxy (Tesseract / Gemini) |

### 16.2 PR2 backend — base `/api` (port 8080)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/requisitions/from-recommendation` | P1 → PR2 handoff; creates a SYSTEM PR |
| `POST` | `/api/requisitions` | Manual or chatbot-derived creation |
| `POST` | `/api/requisitions/parse-intent` | NL → structured intent via Gemini |
| `GET` | `/api/requisitions` | List PRs |
| `POST` | `/api/suppliers/select/{requisitionId}` | Deterministic supplier scoring → chosen supplier |
| `GET` | `/api/suppliers` | List suppliers |
| `POST` | `/api/purchase-orders/{requisitionId}` | Auto-create PO |
| `GET` | `/api/purchase-orders` | List POs |
| `GET` | `/api/purchase-orders/{id}` | Single PO |
| `POST` | `/api/goods-receipts` | Simulate receipt against a PO |
| `GET` | `/api/goods-receipts` | List GRNs |
| `POST` | `/api/invoices/upload` | Multipart invoice → triggers OCR |
| `GET` | `/api/invoices` | List invoices |
| `GET` | `/api/invoices/{id}` | Single invoice |
| `POST` | `/api/invoices/{id}/match` | Run deterministic 3-way match |
| `GET` | `/api/exceptions` | Mismatched / exception invoices |
| `POST` | `/api/exceptions/{id}/resolve` | Manual approve or reject |
| `GET` | `/api/analytics/p2p-summary` | Touchless %, cycle time, exception rate |

---

## 17. Local development setup

### 17.1 Prerequisites

- Node.js 20+
- Java 17+ (use the bundled `mvnw` / `mvnw.cmd`)
- A Supabase project (free tier) with migrations in `infra/supabase/` applied
- A Google Gemini API key (free tier) from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 17.2 Setup (one time)

```bash
# 1. Clone and configure
git clone <your-fork-url> chainvision
cd chainvision
cp .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_*_KEY, GEMINI_API_KEY

# 2. Apply Supabase migrations
supabase db push

# 3. Install dependencies
npm install
cd p1-backend && npm install && cd ..
cd frontend   && npm install && cd ..

# 4. Seed the database
cd shared/seed-data
npx tsx p1_seed.ts
npx tsx pr2_seed.ts
cd ../..
```

### 17.3 Run (three terminals)

```bash
# Terminal 1 — P1 backend (port 4000)
cd p1-backend && npm run dev

# Terminal 2 — PR2 backend (port 8080)
cd pr2-backend
# Windows:        mvnw.cmd spring-boot:run
# macOS / Linux:  ./mvnw spring-boot:run

# Terminal 3 — Frontend (port 5173)
cd frontend && npm run dev
```

Open <http://localhost:5173>. Log in with one of the seeded demo users (see section 12).

### 17.4 Docker Compose (alternative)

```bash
docker compose up
```

The compose file builds `frontend`, `p1-backend`, and `pr2-backend`. **Postgres is Supabase-hosted** — point `SPRING_DATASOURCE_URL` and the Supabase clients at your Supabase project.

---

## 18. The 10-step live demo

This is the script the judges see. The e2e smoke test automates it against a live system via `npm run e2e`.

1. **Login as Planner** — dashboard shows pre-seeded inventory, expiry heatmap, low-stock alerts.
2. **Trigger demand spike** for a tier-2 SKU (Pune, Cold & Flu) — P1 recomputes ROP/EOQ — new Recommendation with AI rationale appears.
3. Recommendation is **auto-sent to PR2** — switch to Procurement dashboard — new system-sourced PR appears in realtime.
4. *(Alternative path)* **Chatbot** input — *"We need 300 units of Amoxicillin for Pune, urgent"* — Gemini extracts intent — form pre-fills.
5. **Supplier selection** — deterministic score breakdown shown — PO auto-created.
6. **Simulate goods receipt** (one click, batch + expiry).
7. **Upload matching invoice** — Gemini extracts fields — three-way match succeeds — payment auto-approved.
8. **Upload mismatched invoice** (quantity off) — three-way match fails deterministically — Exception Queue shows AI explanation of which field and by how much — procurement officer manually resolves.
9. **P2P analytics dashboard** shows touchless rate, cycle time, full-loop summary.
10. **Close** on the original demand signal — full P1 → PR2 loop demonstrated end-to-end.

---

## 19. Testing

| Layer | Framework | Command | What it covers |
|---|---|---|---|
| P1 engines + routes | Vitest | `cd p1-backend && npm test` | All 4 deterministic engines with deterministic fixtures; OCR proxy routes |
| PR2 backend | JUnit + Spring Boot Test | `cd pr2-backend && mvnw test` | Service-layer match logic, supplier scoring, DTOs |
| E2E (full 10-step flow) | tsx + Supertest | `npm run e2e` | P1 → PR2 integration, OCR, 3-way match, exception flow |
| AI services | Mocked Gemini | bundled with above | Every Gemini call is unit-tested against a mock client |

The e2e suite is gated as a manual `workflow_dispatch` trigger in CI (`.github/workflows/e2e-smoke-test.yml`) because it requires live Supabase and a Gemini key. Running on every PR would burn the free-tier rate limit.

```bash
npm run test:p1
npm run test:pr2
npm run e2e
```

---

## 20. Deployment

The stack is designed for in-person hackathon judging via local Docker Compose. For a public URL (judges browsing beforehand):

| Service | Target | Notes |
|---|---|---|
| Frontend | Vercel | Auto-detects Vite; configure `VITE_*` env vars in project settings |
| P1 backend | Render or Railway (free tier, Docker deploy) | One `Dockerfile` per service |
| PR2 backend | Render or Railway (free tier, Docker deploy) | Java 17 runtime |
| Database | Supabase (already hosted) | No action required |

`frontend/vercel.json` and the root `docker-compose.yml` are pre-wired for these paths.

---

## 21. Design decisions — the non-obvious choices

| Decision | Choice | Why |
|---|---|---|
| P1 → PR2 handoff mechanism | REST POST to PR2, with a shared `recommendations` table as documented fallback | Keeps the two services independently deployable; one clean integration boundary; no cross-schema FKs. |
| Realtime hub | Socket.IO inside the P1 Node backend, not native WebSockets in Spring Boot | Saves implementation time on the Java side; P1 already hosts the hub for its own low-stock events. |
| OCR | Gemini multimodal as primary, Tesseract.js as fallback | Gemini handles PDF and image natively with no extra dependency; Tesseract covers the case when the free tier is rate-limited. |
| AI model | Gemini 2.0 Flash | Free tier, no billing account; sufficient quality for rationale and document extraction. |
| Auth | Email + password, shared JWT secret across both backends | Simplest setup that satisfies role-gated dashboards; SSO/OAuth out of scope. |
| Database | Single Postgres instance, two logical schemas | Relational integrity needed for PO ↔ GRN ↔ Invoice matching; no NoSQL-shaped problem. |
| Frontend state | Zustand + axios + Socket.IO client | Lightweight; no Redux ceremony. |
| PR2 in Java | Mandated | Team skill profile; Spring Boot gives batteries-included REST, JPA, Security. |
| P1 in Node | Speed of development | JSON-heavy deterministic calc services, fast REST, same language family as the frontend. |
| Supabase over self-hosted Postgres | Free tier, no DevOps overhead | Trade-off: requires a hosted Supabase project for the stack to work. |
| Compose without Postgres | Points at Supabase instead | Single source of truth for DB; no risk of compose running stale migrations. |

---

## 22. Known limitations and honest caveats

- **AI is scoped tightly.** Gemini is used only for the four responsibilities in section 11. It never decides a quantity, threshold, score, or match. This is by design and by project constraint — and it means every business number in the system is reproducible and auditable.
- **OCR is hybrid.** Primary path is Gemini multimodal (handles PDF/image natively). Fallback is Tesseract.js + heuristics if Gemini is rate-limited or the invoice layout breaks the model.
- **Postgres is shared, schemas are not.** `p1` and `pr2` are two logical schemas in one Supabase Postgres instance. Cross-schema references are plain UUID columns — no enforced FKs.
- **No production deployment yet.** This is a hackathon submission. The Docker Compose + Vercel/Render paths are wired but not battle-tested at scale.
- **Two legacy infra folders** (`infra/postgres/` and `infra/postgress/` — yes, the second is typo'd) exist for git history; the active database target is Supabase.
- **The `Documentaion/` folder is intentionally misspelled** to preserve the original commit history; renaming it would create a misleading diff.
- **E2E test is manual in CI.** It needs live Supabase + a Gemini key, so it can't run on every PR.

---

## 23. Where to go next

Depending on what you want to do, here's the minimum further reading:

| If you want to… | Read |
|---|---|
| Understand the architecture at column-level depth | `Documentaion/00_PROJECT_CONTEXT.md` |
| Run the stack locally | Section 17 of this document, then the Quick start section of `README.md` |
| Understand the P1 engines | `p1-backend/src/engine/*.ts` and their `.test.ts` siblings |
| Understand the PR2 3-way match | `pr2-backend/src/main/java/com/chainvision/pr2/service/MatchingService.java` |
| Change the handoff contract | `shared/contracts/replenishmentRecommendation.schema.json` + both backend DTOs |
| Demo to judges | Section 18 of this document |
| Understand why a specific design choice was made | `Documentaion/PROMPTS.md` (AI prompt archive) |
| Track build progress | `Documentaion/CHAINVISION_MASTER_CHECKLIST.md` |
| Add a new top-level folder | Section 14 of this document, then add it to the README's "Project sections" |

---

## 24. Hackathon context

| | |
|---|---|
| **Event** | Cognizant NPN_SCM Hackathon 2026 |
| **Combination** | 4 — P1 (Demand Sensing & Replenishment) + PR2 (Autonomous Procure-to-Pay) |
| **Persona** | MedCare Pharma, multi-DC pharma distributor |
| **Team constraint** | PR2 backend in Java + Spring Boot (team skill profile); P1 backend in Node + Express; frontend in React + Vite + TypeScript |
| **AI budget** | Google Gemini free tier (no paid key, no billing account) |
| **Build window** | 5 days |
| **License** | Internal — not licensed for redistribution |

---

*End of Overview. You now have a complete mental model of the project. The project bible, the README, the source code, and the seed data are there for depth on any specific area. Welcome to the team.*
