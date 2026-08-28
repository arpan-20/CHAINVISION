<div align="center">

<br>

# CHAINVISION

**Integrated Supply Chain Intelligence Platform**

<br>

*Demand Sensing & Replenishment Planning (P1) connected to Autonomous Procure-to-Pay (PR2)
as a single end-to-end pipeline for pharma distribution.*

<br>

**Cognizant NPN_SCM Hackathon 2026** &nbsp;·&nbsp; **Combination 4 (P1 + PR2)** &nbsp;·&nbsp; Built for **MedCare Pharma**

<br>

[Project Bible](./Documentaion/00_PROJECT_CONTEXT.md) &nbsp;·&nbsp; [Architecture](#-architecture) &nbsp;·&nbsp; [Project Sections](#-project-sections) &nbsp;·&nbsp; [Quick Start](#-quick-start) &nbsp;·&nbsp; [API Reference](#-api-reference) &nbsp;·&nbsp; [Demo Flow](#-live-demo-flow)

</div>

<br>

---

<br>

## Overview


CHAINVISION is an integrated supply chain platform that collapses the gap between **demand planning** and **procure-to-pay** into one continuous, mostly-touchless pipeline. It is built for pharma distributors like MedCare Pharma, where stockouts in Tier-2 cities and near-expiry excess in Tier-1 metros are two sides of the same problem.

A replenishment recommendation computed by the deterministic P1 engine is automatically consumed by the PR2 pipeline as a system-sourced purchase requisition, run through deterministic supplier scoring, PO issuance, goods receipt, invoice OCR, and three-way match &mdash; with payment auto-approved or routed to a human exception queue. A human reviewer is in the loop only when deterministic match logic fails.

The system is implemented as three independently deployable services (frontend, P1 backend, PR2 backend) sharing one Supabase-hosted Postgres instance with two logical schemas (`p1`, `pr2`).

> **Design principle:** AI/LLM APIs do not perform core numeric or business calculations. Demand sensing, safety stock, reorder point, EOQ, FEFO sequencing, expiry risk scoring, supplier weighting, and three-way match are all plain deterministic code, unit-tested and reproducible. AI (Google Gemini, free tier) is used only for natural-language requisition intent extraction, human-readable rationale text after the deterministic engine has produced the numbers, invoice document extraction (PDF/image), and plain-English explanations of three-way match failures.

<br>

---

<br>

## Table of contents


1. [Architecture](#-architecture)
2. [Capabilities](#-capabilities)
3. [Tech stack](#-tech-stack)
4. [Repository layout](#-repository-layout)
5. [Project sections](#-project-sections)
6. [P1 → PR2 handoff contract](#-p1--pr2-handoff-contract)
7. [Realtime events](#-realtime-events)
8. [Quick start](#-quick-start)
9. [Environment variables](#-environment-variables)
10. [API reference](#-api-reference)
11. [Database schema](#-database-schema)
12. [Live demo flow](#-live-demo-flow)
13. [Testing](#-testing)
14. [Deployment](#-deployment)
15. [Design decisions](#-design-decisions)
16. [Documentation index](#-documentation-index)

<br>

---

<br>

## ▎ Architecture


<br>

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                      │ React 18 + Vite + TS + Tailwind       │
│                                      │                                       │
│ Planner Dashboard                    │ Procurement Dashboard                 │
│ ─ Inventory                          │ ─ Requisitions                        │
│ ─ Expiry Heatmap                     │ ─ Purchase Orders                     │
│ ─ Replenishment Recs                 │ ─ Goods Receipts                      │
│ ─ Demand Signals                     │ ─ Invoice Upload (OCR)                │
│ ─ AI Insight Banner                  │ ─ Exception Queue                     │
│ ─ Supply-Network 3D                  │ ─ P2P Analytics                       │
│ ─ Socket.IO (realtime)               │ ─ Supplier Scorecards                 │
│                                      │ ─ NL Requisition Chatbot              │
└──────────────────────────────────────────────────────────────────────────────┘
      REST + JWT (role-gated)                            REST + JWT             
                 │                                            │                 
                 ▼                                            ▼                 
┌─────────────────────────────────┐          ┌─────────────────────────────────┐
│ P1 Backend (Node/Express)       │          │ PR2 Backend (Java 17 / Spring)  │
│                                 │          │                                 │
│ ─ Deterministic engines         │          │ ─ Requisition                   │
│ ─ Recommendation service        │          │ ─ Sourcing (weighted scoring)   │
│ ─ Gemini rationale svc          │          │ ─ Purchase Order                │
│ ─ Socket.IO realtime hub        │          │ ─ Goods Receipt                 │
│ ─ JWT issue + verify            │          │ ─ Invoice OCR (Gemini)          │
│ ─ Tesseract.js OCR fallback     │          │ ─ Three-Way Match               │
│                                 │          │ ─ Exception handling            │
│                                 │          │ ─ Payment approval              │
│                                 │          │ ─ JWT verify (Spring Security)  │
└─────────────────────────────────┘          └─────────────────────────────────┘
                 │                                            │                 
                 │                                            │                 
                 ▼                                            ▼                 
   ┌────────────────────────────────────────────────────────────────────────┐   
   │ Supabase Postgres (single instance)                                    │   
   │ schema `p1`     |     schema `pr2`                                     │   
   └────────────────────────────────────────────────────────────────────────┘   
                                       ▲                                        
                               shared JWT secret                                
                                       │                                        
                                       │                                        
                                       ▼                                        
               ┌────────────────────────────────────────────────┐               
               │ Google Gemini API (free tier)                  │               
               │                                                │               
               │ ─ Rationale text                               │               
               │ ─ NL intent extraction                         │               
               │ ─ Multimodal invoice OCR                       │               
               │ ─ Mismatch explanations                        │               
               └────────────────────────────────────────────────┘               
```

<br>

The PR2 Spring Boot service avoids native WebSocket implementation by POSTing state-change events to a single internal endpoint on the P1 Node backend (`POST /internal/realtime/emit`), which fans them out over Socket.IO to connected dashboards. This keeps both services deployable and isolated.

<br>

---

<br>

## ▎ Capabilities


<br>

| | **P1 — Demand Sensing & Replenishment** | **PR2 — Autonomous Procure-to-Pay** |
|---|---|---|
| **Purpose** | Decide *what*, *how much*, and *how urgently* to reorder. | Execute the reorder without human touch until exceptions. |
| **Inputs** | Historical demand, sensed demand signals, batch-level inventory with expiry, DC capacity and lead time. | P1 recommendations, chatbot NL requests, manual entries. |
| **Deterministic engines** | `demandEngine`, `replenishmentMathEngine` (safety stock, ROP, EOQ), `fefoEngine`, `expiryRiskEngine`. | `SupplierService` (weighted scoring), `MatchingService` (three-way match with tolerance). |
| **AI use (Gemini)** | Plain-English rationale for a recommendation whose numbers are already computed. | NL intent extraction, invoice OCR (PDF/image), mismatch explanation. |
| **Outputs** | Replenishment Recommendation (qty, urgency, reason code, AI rationale). | Auto-PO, GRN, auto-matched invoice, auto-approved payment — or Exception Queue entry. |

<br>

---

<br>

## ▎ Tech stack


<br>

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Fast zero-to-demo path; same language family as the P1 backend. |
| UI | Tailwind CSS, Recharts, react-three-fiber | Tailwind for low design overhead; Recharts for dashboards; r3f for the 3D supply-network view. |
| State / data | Zustand, axios, Socket.IO client | Lightweight, no Redux ceremony. |
| P1 backend | Node 20 + Express 4 + TypeScript | JSON-heavy deterministic services, fast REST. |
| P1 DB access | `@supabase/supabase-js` | Direct Postgres access without ORM lock-in. |
| P1 OCR | Tesseract.js + Gemini multimodal | Free tier, no extra account; Gemini primary for document understanding. |
| P1 realtime | Socket.IO | Single hub; no native WebSockets in Spring Boot. |
| PR2 backend | Java 17 + Spring Boot 3.3 (Maven) | Mandated by team skill profile; batteries-included REST, JPA, Security. |
| PR2 DB | Spring Data JPA / Hibernate | Idiomatic Spring data access. |
| Database | PostgreSQL (Supabase) — schemas `p1`, `pr2` | Relational integrity for PO ↔ GRN ↔ Invoice matching. |
| Auth | JWT (Supabase-compatible) + bcrypt | Shared `JWT_SECRET`; P1 issues, PR2 verifies. |
| Container | Docker Compose | One-command local stack. |
| Deploy | Vercel (frontend) / Render or Railway (backends) | Free tier, one-command public URL. |

<br>

---

<br>

## ▎ Repository layout


<br>

```
chainvision/
├── frontend/                              React + Vite + TS + Tailwind + Recharts + r3f
│   └── src/
│       ├── pages/
│       │   ├── planner/                   7 pages: Home, Inventory, Expiry, Recommendations,
│       │   │                              Demand Signals, Spike Simulator, Layout
│       │   ├── procurement/               10 pages: Home, Requisitions, POs, Goods Receipts,
│       │   │                              Invoice Upload, Exceptions, P2P Analytics,
│       │   │                              Supplier Scorecards, NL Chatbot, Layout
│       │   └── LoginPage.tsx
│       ├── components/                    NavBar, AiInsightBanner, LiveActivityFeed,
│       │                                  SupplyNetwork3D, RequireRole, Toast, ErrorBoundary
│       ├── hooks/                         useAuth, useSocket
│       └── api/                           p1Client, pr2Client, apiInterceptor
│
├── p1-backend/                            Node + Express + TS
│   └── src/
│       ├── engine/                        demandEngine, replenishmentMathEngine, fefoEngine,
│       │                                  expiryRiskEngine  (each with sibling .test.ts)
│       ├── services/                      recommendationService, aiRationaleService (Gemini),
│       │                                  pr2ClientService, ocrService, geminiClient,
│       │                                  inventoryService, demandService
│       ├── routes/                        demand, sku, dc, inventory, replenishment, internalOcr
│       ├── realtime/                      Socket.IO hub
│       ├── auth/                          JWT issue + verify
│       ├── db/                            supabaseClient
│       ├── middleware/                    errorHandler
│       └── config/                        env
│
├── pr2-backend/                           Java 17 + Spring Boot
│   └── src/main/java/com/chainvision/pr2/
│       ├── controller/                    AnalyticsController
│       ├── service/                       AnalyticsService, MatchingService, SupplierService
│       ├── requisition/                   controller, service, entity, repository
│       ├── sourcing/                      controller, service, entity, repository
│       ├── purchaseorder/                 controller, service, entity, repository
│       ├── goodsreceipt/                  controller, service, entity, repository
│       ├── invoice/                       controller, service, entity, repository, OcrService
│       ├── exception/                     controller, service, entity, repository
│       ├── payment/                       controller, service, entity, repository
│       ├── ai/                            Gemini client wrapper
│       ├── security/                      JWT verification (Spring Security)
│       ├── dto/                           ReplenishmentRecommendationDto + request/response DTOs
│       ├── entity/                        JPA entities
│       ├── repository/                    Spring Data JPA repositories
│       └── config/                        CORS, security, OpenAPI
│
├── shared/
│   ├── contracts/                         replenishmentRecommendation.schema.json (P1 → PR2 handoff)
│   │                                      README.md
│   └── seed-data/                         p1_seed, pr2_seed, sample_invoices/, README_*.md
│
├── scripts/                               e2e_smoke_test.ts, generate_sku_invoice_pdf.py,
│                                          run-pr2.sh, README_*.md
│
├── Documentaion/                          00_PROJECT_CONTEXT.md (project bible),
│                                          CHAINVISION_MASTER_CHECKLIST.md, PROMPTS.md
│
├── infra/supabase/                        Supabase migrations
├── .github/workflows/                     e2e-smoke-test.yml
├── docker-compose.yml
└── .env.example
```

<br>

---

<br>

## ▎ Project sections

*What each top-level folder in this repository is for, who maintains it, and when you would touch it.*

<br>

### `frontend/`

**The user-facing product — both dashboards in one Vite app.** React 18 + Vite + TypeScript + Tailwind + Recharts, with `@react-three/fiber` + `three` for the 3D supply-network visualization. The app has two role-gated dashboards that share a common `NavBar`, theme tokens, and API clients:

- **Planner dashboard** at `/planner` (PLANNER + ADMIN roles) — inventory, expiry heatmap, replenishment recommendations, demand signals, demand-spike simulator, AI insight banner, and a 3D supply-network view.
- **Procurement dashboard** at `/procurement` (PROCUREMENT_OFFICER + ADMIN roles) — requisitions, purchase orders, goods receipts, invoice upload (with OCR), exception queue, P2P analytics, supplier scorecards, and the NL requisition chatbot.

**Top-level files**

- `App.tsx` — the **route table**. Maps every URL to a page component, gates each route by role via `<RequireRole>`, and renders the `<ErrorBoundary>` + `<ToastContainer>` wrappers. Touch this when you add a page or change role access.
- `main.tsx` — Vite entry point. Mounts `<App />` inside `<BrowserRouter>` and the global theme provider.
- `index.html` — single HTML shell with the `<div id="root">` mount point.
- `index.css` — Tailwind directives + custom CSS variables for the design-system tokens (`--ink`, `--panel`, `--signal`, `--alert`, `--critical`, etc.) that every page consumes.
- `tailwind.config.js` — extends Tailwind with the design tokens, custom fonts (Space Grotesk for display, Inter for body, IBM Plex Mono for numeric/code), and the project-specific color palette.
- `vite.config.ts` — Vite build config, React plugin, dev server port.
- `tsconfig.json` — TypeScript strict-mode config.
- `package.json` — frontend-only dependencies and scripts (`dev`, `build`, `preview`, `lint`).
- `vercel.json` — Vercel deployment config (rewrites, build command) for judges browsing a public URL.
- `Dockerfile` — image build for the compose stack.

**Inside `src/`**

- `pages/LoginPage.tsx` — email + password sign-in. Calls Supabase Auth directly via the anon client, then hydrates the auth store.
- `pages/planner/` — the seven planner pages. Each is a self-contained view; `PlannerLayout.tsx` is the shared shell with the planner-specific nav and a top-level layout.
  - `PlannerHome.tsx` — at-a-glance dashboard: low-stock alerts, recent recommendations, AI insight banner, network status.
  - `InventoryView.tsx` — batch-level inventory table, filterable by SKU and DC, with expiry risk highlighting.
  - `ExpiryHeatmap.tsx` — SKU × DC heatmap where each cell is colored by expiry-risk score.
  - `RecommendationsView.tsx` — list of replenishment recommendations with status, urgency, and the AI rationale expanded inline.
  - `DemandSignalsView.tsx` — historical and sensed demand signals; supports filtering and CSV export.
  - `DemandSpikeSimulator.tsx` — control panel to inject a synthetic demand spike for a tier-2 SKU and watch the deterministic engine recompute in realtime.
- `pages/procurement/` — the ten procurement pages. `ProcurementLayout.tsx` is the shell.
  - `ProcurementHome.tsx` — P2P summary tiles (touchless %, cycle time, exception rate), open exception count, recent activity.
  - `RequisitionsView.tsx` — list + detail view; supports filtering by `source` (SYSTEM / CHATBOT / MANUAL) and `status`.
  - `PurchaseOrdersView.tsx` — PO list with status transitions (ISSUED → ACKNOWLEDGED → RECEIVED → CLOSED).
  - `GoodsReceiptView.tsx` — simulate receipt against an issued PO; captures batch number and expiry date.
  - `InvoiceUploadView.tsx` — multipart upload to PR2; shows OCR-extracted fields and the resulting match outcome.
  - `ExceptionQueueView.tsx` — invoices in MISMATCHED / EXCEPTION state with the AI-generated explanation; manual approve / reject.
  - `P2pAnalyticsView.tsx` — funnel and time-series charts covering touchless %, cycle time, exception rate.
  - `SupplierScorecardPage.tsx` — per-supplier weighted-score breakdown (price · lead time · OTD · quality · capacity).
  - `NlRequisitionChatbot.tsx` — free-text input that calls `POST /api/requisitions/parse-intent` (Gemini), pre-fills a requisition form, and submits on confirm.
- `components/` — shared building blocks:
  - `NavBar.tsx`, `RequireRole.tsx` — routing shell and role guard.
  - `AiInsightBanner.tsx` / `RealDataAiInsightBanner.tsx` — Gemini-rationale callout (real-data variant pulls from the live API).
  - `LiveActivityFeed.tsx` / `RealDataLiveActivityFeed.tsx` — Socket.IO-driven event stream.
  - `SupplyNetwork3D.tsx` — react-three-fiber 3D visualization of SKUs flowing between DCs.
  - `Toast.tsx`, `ErrorBoundary.tsx`, `icons.tsx`, `badges.tsx` — UI primitives.
- `hooks/` — `useAuth` (Supabase session + role), `useSocket` (Socket.IO client lifecycle).
- `api/` — `p1Client.ts` and `pr2Client.ts` are the two axios instances; `apiInterceptor.ts` attaches the JWT, handles 401 → redirect to login, and surfaces error toasts.
- `data/` — small static fixtures used by the mock-data variant of certain views.
- `lib/` — small helpers (formatters, time utilities, type guards).

**Inbound data:** REST calls to P1 (port 4000) and PR2 (port 8080); Socket.IO events from the P1 realtime hub; Supabase Auth session.
**Outbound data:** HTTP requests only — all mutation flows through the backends.

**Start here:** `App.tsx` to learn the route table, then `pages/planner/PlannerHome.tsx` and `pages/procurement/ProcurementHome.tsx` to see the two dashboards' entry points. The design system lives in `tailwind.config.js` + `index.css`; theme changes belong there, not in per-page inline styles.

**Touch this folder when:** changing the UI, adding a new dashboard page, tweaking the design system, or wiring a new realtime event to a live view.
### `p1-backend/`

**The demand-sensing and replenishment-planning service.** Node 20 + Express 4 + TypeScript, deployed on port `4000`. This is where the deterministic engine pipeline lives, the JWT auth is issued, and the Socket.IO realtime hub runs. P1 is the upstream half of the integration: it computes a `Replenishment Recommendation` and POSTs it to PR2.

**Top-level files**

- `src/index.ts` — the Express bootstrap. Wires CORS, JSON parsing, the health route, all `routes/*` under `/api`, the `internalOcrRoutes` (unprefixed, called by PR2), and the global error handler.
- `package.json` — P1-only dependencies and scripts (`dev`, `build`, `test` running `vitest run src tests`).
- `Dockerfile` — image build for the compose stack.
- `tsconfig.json`, `vitest.config.mts` — TypeScript and Vitest config.
- `p1-current.log`, `p1-smoke.log`, `smoke-p1.log`, `smoke-p1.err.log`, `p1-clean.log` — runtime logs (gitignored in spirit, present for debugging). Not source.
- `eng.traineddata` — Tesseract.js language model used by `ocrService.ts`. **Not** source; if you delete it, OCR will re-download it on first run.

**Inside `src/`**

- `engine/` — the four deterministic engines. Each is a pure function over its inputs, fully unit-tested, with zero AI calls in the code path.
  - `demandEngine.ts` — groups historical demand by SKU+DC, applies `sensed_adjustment_pct`, returns adjusted demand.
  - `replenishmentMathEngine.ts` — computes safety stock, reorder point (ROP), and EOQ given demand statistics and lead time.
  - `fefoEngine.ts` — first-expiry-first-out batch sequencing. Sorts inventory batches by expiry date and returns the picking order.
  - `expiryRiskEngine.ts` — converts days-to-expiry into a weighted risk score used for color coding and the heatmap.
  - Each engine ships with a sibling `*.test.ts` using Vitest fixtures.
- `services/` — orchestration and side effects.
  - `recommendationService.ts` — pulls the four engines together for one SKU+DC pair, assigns urgency (`LOW | MEDIUM | HIGH | CRITICAL`), and persists a `replenishment_recommendations` row. **This is the core service.**
  - `aiRationaleService.ts` — calls Gemini with the *already-computed* numbers and asks for a one-paragraph plain-English explanation. The output is stored in `replenishment_recommendations.ai_rationale` and surfaced on the dashboard. **Never** used to compute a quantity.
  - `pr2ClientService.ts` — POSTs new recommendations to `PR2_BASE_URL/api/requisitions/from-recommendation`. Logs and swallows non-fatal errors so a PR2 outage doesn't block the engine.
  - `inventoryService.ts`, `demandService.ts` — thin wrappers over the Supabase client for CRUD on inventory batches and demand signals.
  - `ocrService.ts` — invoice OCR. Tries Gemini multimodal first (PDF/image inline data); falls back to Tesseract.js on the rasterized page if Gemini fails or the free tier is rate-limited. Returns a structured payload that the PR2 invoice service expects.
  - `geminiClient.ts` — central wrapper around `@google/generative-ai` so every Gemini call goes through one place (and is easy to mock in tests).
- `routes/` — Express routers, each mounted under `/api`:
  - `skuRoutes.ts` — `GET /api/skus`
  - `dcRoutes.ts` — `GET /api/distribution-centers`
  - `inventoryRoutes.ts` — `GET /api/inventory` (filterable by sku/dc), batch CRUD
  - `demandRoutes.ts` — `GET/POST /api/demand-signals`
  - `replenishmentRoutes.ts` — `GET /api/replenishment/recommendations` (filterable), `POST /api/replenishment/recalculate` (triggers the engine), `GET /api/replenishment/recommendations/:id`
  - `internalOcrRoutes.ts` — `POST /internal/ocr/extract`, the proxy that PR2 calls. Mounted unprefixed at the root.
- `realtime/` — the **single Socket.IO hub** for the whole system. PR2 does *not* run its own WebSocket server; it POSTs to `POST /internal/realtime/emit` on P1, which fans the event out to connected clients.
- `auth/` — JWT issue and verify. Login (`POST /api/auth/login`) and register (`POST /api/auth/register`) issue HS256 tokens using `JWT_SECRET`; verify middleware is reused by the protected routes.
- `db/` — `supabaseClient.ts`, a single shared Supabase client instance.
- `middleware/` — `errorHandler.ts` catches everything and returns a uniform JSON error shape.
- `config/` — `env.ts` reads and validates environment variables at startup using Zod; any missing required var fails fast with a clear error.
- `routes/internalOcrRoutes.test.ts` — Vitest suite for the OCR proxy.

**Inbound data:** HTTP from the frontend; webhook POSTs from PR2 (`/internal/realtime/emit`); Gemini API calls (for rationale and OCR).
**Outbound data:** Supabase Postgres reads and writes; HTTP POST to PR2 (`/api/requisitions/from-recommendation`); HTTP POST to Gemini API.

**Start here:** `src/index.ts` to see the wiring, then `engine/replenishmentMathEngine.ts` to understand how a recommendation is computed, then `services/recommendationService.ts` to see the orchestration, then `services/aiRationaleService.ts` to see the *only* place Gemini is used in the numeric pipeline.

**Touch this folder when:** changing how a number is computed (any file in `engine/`), adding a new demand signal source, tuning AI scope or prompt text, wiring up a new realtime event, or adding a new REST endpoint.
### `pr2-backend/`

**The autonomous procure-to-pay service.** Java 17 + Spring Boot 3.3 (Maven), deployed on port `8080`. This is the downstream half of the integration: it receives system-sourced purchase requisitions from P1, runs deterministic supplier scoring, generates POs, simulates goods receipts, performs invoice OCR (via Gemini), runs three-way match, and auto-approves or escalates to the exception queue.

**Top-level files**

- `pom.xml` — Maven build. Spring Boot 3.3 parent, dependencies: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server`, `spring-boot-starter-validation`, `org.postgresql:postgresql` (runtime). Java 17 source/target. Surefire configured with `-Dnet.bytebuddy.experimental=true` for the test JVM.
- `mvnw` / `mvnw.cmd` — Maven wrapper scripts (use these, not a system Maven).
- `Dockerfile` — image build for the compose stack.
- `SETUP.md` — detailed step-by-step PR2 setup notes (Supabase URL format, JWT secret sharing, port conflicts). **Read this** if the PR2 backend won't start.
- `local-dev/` — dev-only resources (H2 config snippets, etc.).
- `uploads/` — directory where uploaded invoice files are persisted by the multipart endpoint. Gitignored in spirit; present in the demo with seed invoices copied in.
- `target/` — Maven build output (compiled classes, JAR, test reports). Not source.
- `.vscode/`, `.mvn/` — IDE and Maven wrapper config.

**Inside `src/main/java/com/chainvision/pr2/`**

The package layout mirrors the P2P stages plus cross-cutting concerns, one package per stage:

- `Pr2Application.java` — Spring Boot entry point. `@SpringBootApplication`, scans the package.
- `controller/` — REST controllers. Currently `AnalyticsController.java` exposes `GET /api/analytics/p2p-summary`. Other controllers live inside their per-stage package (see below).
- `service/` — top-level services that don't fit a single stage:
  - `AnalyticsService.java` — touchless %, cycle time, exception rate aggregations over the PR2 tables.
  - `MatchingService.java` — **the deterministic 3-way match engine**. Compares PO quantity/price against GRN and OCR'd invoice values, applies tolerance rules, and writes a `three_way_matches` row. This is the second of the two critical deterministic services in CHAINVISION (the other being `SupplierService`).
  - `SupplierService.java` — **the deterministic supplier scoring service**. Weighted score over price, lead time, OTD, quality, and capacity. Returns the best-fit supplier for a requisition. No LLM in the scoring.
- `requisition/` — the Requisition stage. `controller` exposes `POST /api/requisitions/from-recommendation` (the P1 handoff), `POST /api/requisitions`, `POST /api/requisitions/parse-intent` (Gemini NL extraction), `GET /api/requisitions`. `entity` is the JPA-mapped `PurchaseRequisition` with `source` enum (SYSTEM / CHATBOT / MANUAL) and nullable `recommendation_id` link to P1. `service` orchestrates the stage. `repository` is the Spring Data JPA interface.
- `sourcing/` — supplier evaluation. Calls `SupplierService`, persists the chosen supplier on the requisition.
- `purchaseorder/` — PO stage. Auto-creates a `PurchaseOrder` from a sourced requisition, sets `unit_price` and `total_amount` from the supplier's price index × quantity, transitions the status enum.
- `goodsreceipt/` — GRN stage. `POST /api/goods-receipts` simulates receipt against a PO; captures `batch_no`, `received_qty`, and `expiry_date` for downstream 3-way match.
- `invoice/` — invoicing + OCR + match. The big one.
  - `controller` exposes `POST /api/invoices/upload` (multipart), `GET /api/invoices`, `GET /api/invoices/{id}`, `POST /api/invoices/{id}/match`.
  - `OcrService.java` — calls out to P1's `/internal/ocr/extract` (which uses Gemini multimodal first, Tesseract.js fallback). Persists the extracted fields as `raw_ocr_json` (jsonb).
  - `service` runs the match by delegating to top-level `MatchingService`.
- `exception/` — exception queue. `GET /api/exceptions` lists mismatched invoices; `POST /api/exceptions/{id}/resolve` accepts manual approve/reject from a procurement officer.
- `payment/` — payment approval. Sets `payment_approvals.status` to `AUTO_APPROVED` on match-success, `PENDING_REVIEW` on match-failure, persists `approved_by` on manual resolution.
- `ai/` — Gemini client wrapper for any PR2-side AI calls (currently minimal; the heavy lifting is on the P1 side).
- `security/` — Spring Security config: JWT verification using the shared `JWT_SECRET`, role-based access on routes, CORS allowlist for the frontend origins.
- `dto/` — request/response DTOs. The most important one is `ReplenishmentRecommendationDto`, which mirrors `shared/contracts/replenishmentRecommendation.schema.json` — this is the Java shape that validates the P1 handoff payload.
- `entity/` — JPA entities (one per table in schema `pr2`).
- `repository/` — Spring Data JPA repository interfaces.
- `config/` — CORS, security, OpenAPI/Swagger (if enabled), and any other Spring beans.

**Inside `src/main/resources/`**

- `application.yml` — Spring config: server port, datasource, JPA settings (`ddl-auto`, `properties.hibernate.dialect=PostgreSQLDialect`, `default_schema=pr2`), JWT secret, P1 base URL, P1 OCR URL, P1 realtime URL, internal API key, Gemini API key, CORS allowed origins.

**Inbound data:** HTTP from the frontend; POST from P1 at `/api/requisitions/from-recommendation`; multipart file uploads for invoices; webhook callbacks to P1 at `/internal/realtime/emit`.
**Outbound data:** Supabase Postgres (schema `pr2`); HTTP POST to P1 (`/internal/realtime/emit`, `/internal/ocr/extract`); HTTP POST to Gemini API for any PR2-side AI calls.

**Start here:** `Pr2Application.java` to see the bootstrap, then `service/MatchingService.java` and `service/SupplierService.java` to see the two critical deterministic services, then `requisition/controller/*` to see the P1 handoff endpoint, then `invoice/OcrService.java` and the entity classes to understand persistence.

**Touch this folder when:** adding a new P2P stage, changing supplier weighting, tuning 3-way match tolerance, adding a new exception type, modifying the handoff DTO, or changing the Spring Security config.
### `shared/`

**Cross-service artefacts that both backends (and the seed scripts) need to agree on.** Anything in this folder is a *contract* between services, not code that runs in any one place. Changes here are coordination changes — they require updating P1, PR2, and the seed scripts in the same commit.

**Subfolders**

- `contracts/`
  - `replenishmentRecommendation.schema.json` — **the P1 → PR2 handoff contract.** P1 emits this exact JSON shape; PR2 validates incoming payloads against it. The schema covers identifiers (`recommendationId`, `skuId`, `dcId`), the already-computed quantity and urgency, the deterministic reason code, the AI-generated rationale, the expiry-risk context string, and the ISO-8601 generation timestamp. **No supplier, PO, invoice, or payment fields leak into the handoff** — those decisions stay inside PR2.
  - `README.md` — describes the contract, its scope rules, and the "this is the integration boundary" principle. Read this before editing the schema.
- `seed-data/`
  - `p1_seed.ts` and `p1_seed_data.json` — TypeScript seed for the P1 schema. Creates ~15–20 SKUs across 2–3 categories (antibiotics, analgesics, cold/flu), 4–6 DCs (at least 2 tier-1 metros, 2 tier-2 cities), 90 days of historical demand, a seasonal +60% spike scenario, and inventory batches including near-expiry and below-ROP examples. **Run with `npx tsx p1_seed.ts` from inside this folder** after the Supabase migrations are applied.
  - `pr2_seed.ts` and `pr2_seed_data.json` — TypeScript seed for the PR2 schema. Creates 6–10 suppliers (deliberately including a "cheap but unreliable" and a "premium but high-performing" example), a handful of pre-existing POs and GRNs in mixed states, and references to the sample invoice files.
  - `sample_invoices/` — PDF and JPG fixtures used by the OCR demo. Includes three representative cases: a clean matching invoice, a quantity-mismatch invoice, and a price-mismatch invoice. The PR2 invoice service is tested against these.
  - `README_p1.md` and `README_pr2.md` — document what each seed script creates, in what order, and why. **Read these before running the seeds** — they list the demo user emails and the prerequisites (Supabase must be migrated first).

**Why this folder exists**

The integration boundary is the most fragile part of the system. By isolating the contract in one folder (rather than duplicating the JSON shape inside both backends), we make one change in one place and force a coordinated update via code review. The same applies to seed data: both backends depend on the same demo dataset, so the data lives in one folder that both backends read.

**Touch this folder when:**
- changing the integration contract (update the JSON schema **and** `pr2-backend/.../dto/ReplenishmentRecommendationDto.java` **and** any P1 caller in the same PR)
- updating seed data to reflect new demo scenarios (add a SKU, a DC, a supplier, a seasonal spike)
- adding a new sample invoice for the OCR stage (drop the file in `sample_invoices/` and reference it in `pr2_seed_data.json`)
- documenting a new cross-service convention

**Do not** put runtime configuration, env templates, or per-service code in this folder — it is reserved for *shared* artefacts only.
### `scripts/`

**Operational and demo-test scripts that don't belong inside any one service.** Anything in this folder is a *tool* that an engineer or CI runner invokes — not application code that runs as part of either backend.

**Files**

- `e2e_smoke_test.ts` — **the primary integration test.** A TypeScript script that walks the full 10-step demo flow (login → demand spike → system-sourced PR → supplier selection → PO → goods receipt → invoice upload → 3-way match → exception resolution → analytics summary) against a live running stack. Uses axios to call P1 and PR2 REST endpoints directly and asserts the expected state transitions.
  - Run with `npm run e2e` from the repo root (the root `package.json` dispatches to `tsx scripts/e2e_smoke_test.ts`).
  - Gated as a manual `workflow_dispatch` trigger in `.github/workflows/e2e-smoke-test.yml` because it needs a real Supabase project and a working Gemini model; running on every PR would burn the free-tier rate limit.
  - Reads env vars: `P1_BASE_URL` (default `http://localhost:4000`), `PR2_BASE_URL` (default `http://localhost:8080`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD`.
- `README_smoke_test.md` — full instructions for running the e2e test locally, including the demo user creation step, env var setup, and what each step asserts.
- `generate_sku_invoice_pdf.py` — a Python script that synthesizes a fresh PDF invoice for any (SKU, supplier, qty) combination. Used to expand the `sample_invoices/` fixtures without manually authoring PDFs. Run with `python scripts/generate_sku_invoice_pdf.py <sku_code> <quantity> <unit_price>`. Output goes to `pr2-backend/uploads/`.
- `README_invoice_demo.md` — docs for the invoice generator.
- `run-pr2.sh` — a thin shell wrapper that exports the env vars needed for the PR2 backend and runs `mvnw spring-boot:run`. Convenient for local dev; not used by the compose stack.

**Why this folder exists**

Three reasons. First, the e2e test is a *cross-service* check — it can't live in `p1-backend/tests/` because it also talks to PR2, and it can't live in `pr2-backend/src/test/` because it also talks to P1. Second, the invoice generator is a *demo authoring* tool, not application code; it doesn't have a deployable artifact. Third, dev convenience scripts (like `run-pr2.sh`) are useful at the repo level and clutter a service folder.

**Touch this folder when:**
- the integration test needs to cover a new flow (add a step in `e2e_smoke_test.ts` and update `README_smoke_test.md`)
- demo invoices need refreshing (run the generator or add new fixtures)
- the team needs a new operational helper (cleanup script, seed-only script, log analyzer, etc.)
- the smoke test's env var contract changes (update the workflow YAML, the README, and the test's `process.env` reads together)

**Do not** add per-service unit tests here — those belong in `p1-backend/src/**/__tests__/` or `pr2-backend/src/test/java/`. This folder is for *cross-service* and *operational* scripts only.
### `infra/`

**Infrastructure-as-code and migration scripts.** This folder exists to keep all the things related to *where the data lives* in one place, separate from the application code that reads and writes that data.

**Subfolders**

- `infra/supabase/` — **the active database target.** Contains the Supabase CLI migrations and configuration that provision the `p1` and `pr2` Postgres schemas, the tables, the indexes, the RLS policies (if any), and the seed users. Apply with the Supabase CLI before running the seed scripts:
  ```bash
  supabase db push
  # or, for local dev:
  supabase start && supabase db reset
  ```
  Migrations are timestamp-prefixed SQL files (e.g. `20260101000000_create_p1_schema.sql`) and run in order. Each migration should be reversible via a paired down-migration in the same file when possible.
- `infra/postgres/` — earlier local-Docker Postgres init scripts from the original implementation plan. Created when the team planned to run Postgres in a Docker container as part of the compose stack. **Superseded by the Supabase-hosted setup.** Kept for git history; do not modify.
- `infra/postgress/` — typo'd copy of `infra/postgres/`. Same content, same status (superseded, do not modify). The typo is preserved to keep the original commit history readable; renaming the folder would create a misleading diff that suggests we made a deliberate change.

**Why two legacy folders**

When the project migrated from "Postgres in Docker" to "Postgres on Supabase" mid-build, the original `infra/postgres/` was not deleted because the migration was never cleanly committed (the change happened across multiple AI dev sessions). The `postgress/` folder is the same content with a typo from one of those sessions. Rather than clean up the typo retroactively, the team chose to leave both for now and document them here. A future cleanup PR can remove them once the Supabase migration path is fully validated.

**Touch this folder when:**
- adding a new table, column, index, or constraint — write a new timestamped migration under `infra/supabase/`
- changing the schema in a way that requires a data migration (e.g. backfilling a new column) — pair the schema migration with a data migration
- modifying the Supabase project config (auth settings, storage buckets, edge function config)
- documenting a database-related operational change (new env var, new backup policy, etc.)

**Do not** touch the `postgres/` and `postgress/` legacy folders. They exist for history only.

**Database is NOT in the compose stack.** `docker-compose.yml` builds the frontend and both backends but does **not** run Postgres locally. This is by design — Supabase's free tier provides a hosted Postgres instance with the same JDBC driver, eliminating the need to maintain a local DB container. The trade-off is that the compose stack requires an external `.env` pointing at a real Supabase project; a fully-offline demo is not supported.
### `supabase/`

**The Supabase project configuration that lives alongside the source tree** rather than inside `infra/`. This folder is what the Supabase CLI reads when you run `supabase start`, `supabase db push`, `supabase functions deploy`, or any other CLI command that needs project-level settings.

**Files**

- `config.toml` — the **Supabase project config**. Defines the project ID, the API URL, the auth providers (email/password is enabled; OAuth providers are not), the JWT settings, the storage buckets, the edge function settings, and the database connection details. The values in this file are read by the Supabase CLI at deploy time and by the Supabase local-dev stack.
- `.gitignore` — excludes the `.temp/` cache directory and any locally generated secrets.
- `.temp/` — local cache for the Supabase CLI (auth tokens, project snapshots). Not source.

**Why a separate `supabase/` folder instead of nesting it under `infra/`**

Two reasons. First, the Supabase CLI expects `supabase/config.toml` at the repo root (or the path passed via `--config`), so the folder must be at the top level. Second, `infra/supabase/` is the *migrations* subfolder; `supabase/` is the *project config* root. They serve different purposes and are managed by different commands.

**Touch this folder when:**
- changing the Supabase project ID or API URL
- adding or removing an auth provider (e.g. enabling Google OAuth in addition to email/password)
- configuring a new storage bucket
- adding a Supabase Edge Function (the CLI scaffolds the function under `supabase/functions/`)
- changing the local-dev stack configuration (e.g. switching the local Postgres version)
- documenting a Supabase-related operational change

**Do not** put SQL migrations here — those belong in `infra/supabase/migrations/`. The `supabase/` root is for *project config*, `infra/supabase/` is for *schema and data migrations*.
### `Documentaion/`

**The documentation that isn't a README.** Three files that document the project at different levels of depth. The folder name is intentionally misspelled (it should be "Documentation") to preserve the original commit history; renaming it would create a misleading diff.

**Files**

- `00_PROJECT_CONTEXT.md` — **the project bible.** The single source of truth for architecture, schema, build plan, 5-day roadmap, AI-scope rules, and the demo flow. This is the document every new contributor should read first; the README is the index, this is the substance. Sections cover: project overview, P1 and PR2 functional requirements, the P1 → PR2 integration story, exact tech stack, architecture diagram, full database schema, realtime design, AI responsibilities, OCR scope, authentication, folder structure, API structure, environment variables, seed data requirements, the 10-step demo flow, definition of done, and the 5-day priorities. **~650 lines. Read the whole thing once; refer back to specific sections as needed.**
- `CHAINVISION_MASTER_CHECKLIST.md` — phase-by-phase task checklist with status. Tracks build progress from foundation (Day 1) through polish (Day 5). Each task has a checkbox, an owner (when assigned), and a status (TODO / IN PROGRESS / DONE). **Used during the build to keep the team honest about what was actually shipped vs. aspirationally listed.** Post-hackathon, this also serves as a record of what was scoped, deferred, or descoped.
- `PROMPTS.md` — an archive of the AI dev prompts used to build the project, in order. Useful for understanding *why* specific implementation choices were made (e.g. "the prompt that produced the FEFO engine had the constraint X, which is why the function signature is Y"). Reading this in sequence is a high-bandwidth way to absorb the project's history without sitting through a video walkthrough.

**Why a separate `Documentaion/` folder instead of nested in the README**

The README is a *summary* — what the project is, how to run it, where to find things. `00_PROJECT_CONTEXT.md` is the *substance* — why those choices were made, what the constraints were, what the full schema looks like at column-level granularity, and what the build plan was. Keeping them separate means:
- The README stays scannable and friendly to first-time readers.
- The project context can grow (it already has 650 lines and would balloon if merged) without making the README unreadable.
- The checklist and prompts can be versioned independently — they belong to the build process, not to the final product.

**Touch this folder when:**
- the project context changes — new architecture decision, new constraint, new technology choice, new roadmap update. Update the corresponding section in `00_PROJECT_CONTEXT.md` and reference the change in the next PR.
- the build plan shifts (a task moves between days, gets descoped, gets added). Update the relevant day in `CHAINVISION_MASTER_CHECKLIST.md`.
- a major AI-driven decision needs to be recorded for posterity. Append the prompt and the resulting decision to `PROMPTS.md` so future contributors can audit the reasoning.
- the documentation is being prepared for a different audience (judges, post-hackathon maintainers, a customer demo). Add a new file rather than mutating existing ones.

**Read order for a new contributor:** `00_PROJECT_CONTEXT.md` (skim the architecture and schema sections, read the AI-scope rules carefully), then this README, then the relevant `p1-backend/` or `pr2-backend/` source as needed. `CHAINVISION_MASTER_CHECKLIST.md` and `PROMPTS.md` are optional — useful if you want to understand the *history* of the project, not just its current state.
### `.github/`

**GitHub-specific configuration.** Anything that GitHub itself reads to render the repo UI, run CI, or apply repo-level settings lives here. This folder is opaque to the application code; the backends and frontend never reference it.

**Subfolders**

- `workflows/` — GitHub Actions workflow definitions. Currently:
  - `e2e-smoke-test.yml` — a single manual-trigger workflow (`workflow_dispatch`) that runs the full 10-step e2e flow from `scripts/e2e_smoke_test.ts` against a live system. The job spins up an Ubuntu runner, installs Node, runs `npm install` at the repo root and inside `p1-backend/` and `frontend/`, and then `npm run e2e`. It is gated as a manual trigger because it requires:
    1. A live Supabase project URL and keys (provided as repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
    2. A demo user in Supabase Auth (email and password provided as `SMOKE_TEST_EMAIL` and `SMOKE_TEST_PASSWORD`).
    3. A working Gemini API key (provided as `GEMINI_API_KEY`).
    4. The PR2 backend running and reachable from the runner.

    The comment block at the top of the file documents these requirements and explains why the workflow is `workflow_dispatch` rather than `pull_request` (the secret-rotation and free-tier rate-limit trade-offs).

  The file also has a commented-out `pull_request` trigger block showing what would need to be wired to run on every PR. It is left in for documentation purposes; do not uncomment without first provisioning the required secrets and verifying the free-tier Gemini quotas.

**Other files possibly in this folder (not currently present)**

- `ISSUE_TEMPLATE/` — GitHub issue templates. Useful if the repo is opened for external contribution post-hackathon.
- `PULL_REQUEST_TEMPLATE.md` — PR template that pre-fills the description box.
- `CODEOWNERS` — file-based code ownership, used by GitHub to auto-assign reviewers.
- `dependabot.yml` — Dependabot config for automated dependency update PRs.

**Why this folder exists**

GitHub reserves the `.github/` directory name for its own config files. Putting workflow YAMLs anywhere else would mean GitHub doesn't pick them up. The folder is named with a leading dot to match the convention used by `.gitignore`, `.env.example`, `.vscode/`, etc.

**Touch this folder when:**
- adding CI checks (lint, type-check, build, test) on push or pull request
- configuring branch protection rules (via the GitHub UI, but the workflow YAML often needs to be in sync)
- adding a deployment automation (CD) that pushes to Render / Railway / Vercel on merge to main
- wiring Dependabot for automated dependency updates
- adding issue or PR templates

**Do not** put application secrets here — the workflow YAML references repo secrets by name, but the values live in GitHub's encrypted secrets store, not in the file. Never commit a real API key, even for a "test" key.
### `docker-compose.yml`, `.env.example`, `package.json`

**Repo-root configuration files** that the rest of the project depends on. They are at the root (not inside a service folder) because they span multiple services or coordinate the workspace.

**`docker-compose.yml`**

Defines the multi-container local-dev stack. Currently builds three services:

- `frontend` — context `./frontend`, port `5173`, runs `npm run dev -- --host` for hot reload.
- `p1-backend` — context `./p1-backend`, port `4000`, runs `npm run dev`.
- `pr2-backend` — context `./pr2-backend`, port `8080`, build from the Dockerfile.

Each service has a `volumes:` mount that bind-mounts the source folder into the container (so edits on the host are picked up live) and an anonymous volume for `node_modules` (so the host's `node_modules` doesn't pollute the container, and vice versa). All three services read `.env` from the repo root via `env_file`.

**`docker-compose.yml` does not include a `postgres` service.** The database is Supabase-hosted (see `infra/`). This is a deliberate choice — Supabase's free tier provides a managed Postgres instance with the same JDBC driver, eliminating the need to maintain a local DB container. The trade-off is documented in the `infra/` section above.

**`.env.example`**

The annotated template of every environment variable the application reads. Currently lists:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project credentials.
- `JWT_SECRET` — shared HS256 secret used by P1 to issue and PR2 to verify tokens. **Must be identical in both backend envs** or auth breaks.
- `GEMINI_API_KEY`, `GEMINI_MODEL` — Google Gemini credentials. Free tier; no billing required.
- `P1_PORT`, `PR2_PORT` — service ports (defaults 4000 and 8080).
- `PR2_BASE_URL` — the URL the P1 backend uses to call PR2's handoff endpoint. In compose this is `http://pr2-backend:8080`; in local dev, `http://localhost:8080`.
- `P1_BASE_URL`, `P1_OCR_URL`, `P1_REALTIME_URL` — the URLs the PR2 backend uses to call P1's internal endpoints.
- `INTERNAL_API_KEY`, `INTERNAL_REALTIME_KEY` — shared secrets for service-to-service calls (not user JWTs).
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` — the JDBC connection details for the PR2 backend. The URL must include `currentSchema=pr2&sslmode=require` for Supabase.
- `VITE_P1_API_BASE`, `VITE_PR2_API_BASE`, `VITE_SOCKET_URL` — the URLs the frontend's axios and Socket.IO clients connect to. Vite reads these at build time, so changing them requires a rebuild.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — frontend Supabase config for the auth client.

**`package.json`**

The workspace-level package manifest. Defines:

- `scripts`:
  - `test:p1` — dispatches to `cd p1-backend && npm test`
  - `test:pr2` — dispatches to `cd pr2-backend && mvnw.cmd test` (note: hardcoded `.cmd`; on macOS/Linux, run `./mvnw test` directly inside `pr2-backend/`)
  - `e2e` — dispatches to `tsx scripts/e2e_smoke_test.ts`
- `dependencies` — only `axios`, which is needed by the e2e script. Each service has its own `package.json` with its own dependencies.
- `devDependencies` — ESLint, TypeScript ESLint, etc., for the workspace-level lint config (currently unused by the services, which have their own lint configs).
- `private: true` — prevents accidental `npm publish` of the workspace.

**Touch this folder when:**
- adding a new service to the compose stack
- changing the build context for an existing service
- adding a new env var (update both `.env.example` and the service that reads it)
- adjusting the workspace-level scripts (e.g. adding a `format` or `lint:all` script)
- bumping a dependency version that affects all services (rare — prefer per-service bumps)

**Do not** put real secrets in `.env` and commit it. The `.gitignore` should already exclude `.env`; if it doesn't, add it immediately.
## ▎ P1 → PR2 handoff contract


<br>

When the P1 engine determines an SKU/DC combination requires replenishment, it emits a `Replenishment Recommendation`. PR2's `POST /api/requisitions/from-recommendation` consumes the same object and creates a system-sourced `purchase_requisitions` row.

```jsonc
// Full schema: shared/contracts/replenishmentRecommendation.schema.json
{
  "recommendationId": "rec_abc123",
  "skuId":            "sku_paracetamol_500",
  "skuName":          "Paracetamol 500mg",
  "dcId":             "dc_pune",
  "recommendedQty":   500,                                    // computed by EOQ; never by AI
  "urgency":          "HIGH",                                 // LOW | MEDIUM | HIGH | CRITICAL
  "reason":           "BELOW_ROP",                            // deterministic reason code
  "aiRationale":      "Recommending 500 units for Pune DC:    // one-paragraph Gemini rationale
                      current stock covers 2.3 days against
                      a +60% sensed demand spike, ROP (420)
                      breached.",
  "expiryRiskContext": "BATCH-A expiring in 12d",
  "generatedAt":      "2026-08-28T03:30:00Z"
}
```

<br>

The contract deliberately contains no supplier, PO, invoice, or payment fields. Those decisions stay inside PR2 after the handoff.

<br>

---

<br>

## ▎ Realtime events


<br>

A single Socket.IO server runs inside the P1 Node backend. PR2 makes an authenticated `POST /internal/realtime/emit` whenever its state changes; P1 fans the event out to connected dashboards.

<br>

| Event | Source | Payload |
|---|---|---|
| `low_stock_alert` | P1 engine | sku, dc, currentQty, threshold |
| `replenishment_recommendation_created` | P1 engine | full recommendation object |
| `requisition_created` | PR2 → webhook → P1 | requisition summary |
| `po_issued` | PR2 → webhook → P1 | PO summary |
| `invoice_uploaded` | PR2 → webhook → P1 | invoice id, status |
| `three_way_match_result` | PR2 → webhook → P1 | MATCHED / MISMATCHED + reason |
| `payment_status_changed` | PR2 → webhook → P1 | invoice id, new status |

<br>

If Socket.IO is unavailable, both dashboards fall back to 5–10 second polling on list endpoints. This is flagged in code as a `TODO` fallback, not the primary design.

<br>

---

<br>

## ▎ Quick start


<br>

### Prerequisites


- Node.js 20+
- Java 17+ (use the bundled `mvnw` / `mvnw.cmd`)
- A Supabase project (free tier) with migrations in `infra/supabase/` applied
- A Google Gemini API key (free tier) — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

<br>

### Setup


```bash
# 1. Clone and configure
git clone <your-fork-url> chainvision
cd chainvision
cp .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_*_KEY, GEMINI_API_KEY

# 2. Apply Supabase migrations (Supabase CLI or SQL editor)

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

<br>

### Run (three terminals)


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

<br>

Open <http://localhost:5173>. Seeded demo users:

<br>

| Email | Password | Role | Lands on |
|---|---|---|---|
| `planner@chainvision.test` | `demo1234` | `PLANNER` | Planner dashboard |
| `procurement@chainvision.test` | `demo1234` | `PROCUREMENT_OFFICER` | Procurement dashboard |
| `admin@chainvision.test` | `demo1234` | `ADMIN` | Both |

<br>

### Docker Compose (alternative)


```bash
docker compose up
```

The compose file builds `frontend`, `p1-backend`, and `pr2-backend`. Postgres is **Supabase-hosted** (not run locally) — point `SPRING_DATASOURCE_URL` and the Supabase clients at your Supabase project.

<br>

---

<br>

## ▎ Environment variables


<br>

All variables are loaded from the repo-root `.env`. The full annotated template is in [`.env.example`](./.env.example).

<br>

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | yes | both backends, frontend | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | both backends, frontend | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | backends | Supabase service role (server-side) |
| `JWT_SECRET` | yes | both backends | Shared JWT signing secret |
| `GEMINI_API_KEY` | yes | both backends | Google Gemini API key (free tier) |
| `GEMINI_MODEL` | no | both backends | Default `gemini-2.0-flash` |
| `P1_PORT` | no | p1-backend | Default `4000` |
| `PR2_PORT` | no | pr2-backend | Default `8080` |
| `PR2_BASE_URL` | yes | p1-backend | URL of PR2 service for the handoff POST |
| `P1_BASE_URL` | yes | pr2-backend | URL of P1 service for OCR proxy and realtime emit |
| `P1_OCR_URL` | yes | pr2-backend | P1 OCR proxy endpoint |
| `P1_REALTIME_URL` | yes | pr2-backend | P1 realtime emit endpoint |
| `INTERNAL_API_KEY` | yes | both backends | Shared key for internal service-to-service calls |
| `INTERNAL_REALTIME_KEY` | yes | both backends | Shared key for the realtime webhook |
| `SPRING_DATASOURCE_URL` | yes | pr2-backend | JDBC URL with `currentSchema=pr2&sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | yes | pr2-backend | Supabase DB credentials |
| `VITE_P1_API_BASE` | yes | frontend | Default `http://localhost:4000/api` |
| `VITE_PR2_API_BASE` | yes | frontend | Default `http://localhost:8080/api` |
| `VITE_SOCKET_URL` | yes | frontend | Default `http://localhost:4000` |

<br>

> `GEMINI_API_KEY` is read from the environment only. Never hardcode or commit it.

<br>

---

<br>

## ▎ API reference


<br>

### P1 backend — base `/api` (port `4000`)


<br>

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

<br>

### PR2 backend — base `/api` (port `8080`)


<br>

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
| `POST` | `/api/invoices/{id}/match` | Run deterministic three-way match |
| `GET` | `/api/exceptions` | Mismatched / exception invoices |
| `POST` | `/api/exceptions/{id}/resolve` | Manual approve or reject |
| `GET` | `/api/analytics/p2p-summary` | Touchless %, cycle time, exception rate |

<br>

---

<br>

## ▎ Database schema


<br>

Two logical schemas in one Supabase Postgres instance. Cross-schema references (e.g. `pr2.purchase_requisitions.recommendation_id`) are plain UUID columns, not enforced foreign keys, because the two services must be independently deployable.

<br>

### Schema `p1`


<br>

| Table | Key columns |
|---|---|
| `skus` | `id`, `sku_code`, `name`, `category`, `unit_cost`, `lead_time_days` |
| `distribution_centers` | `id`, `dc_code`, `name`, `region` (tier-1 / tier-2), `capacity_units` |
| `inventory_batches` | `id`, `sku_id`, `dc_id`, `batch_no`, `quantity`, `expiry_date`, `received_date` |
| `demand_signals` | `id`, `sku_id`, `dc_id`, `signal_date`, `historical_demand`, `sensed_adjustment_pct`, `source` |
| `replenishment_recommendations` | `id`, `sku_id`, `dc_id`, `recommended_qty`, `reorder_point`, `safety_stock`, `eoq`, `urgency`, `reason_code`, `ai_rationale`, `status`, `created_at` |
| `users` | shared auth table, `role` enum |

<br>

### Schema `pr2`


<br>

| Table | Key columns |
|---|---|
| `suppliers` | `id`, `name`, `price_index`, `avg_lead_time_days`, `otd_score`, `quality_score`, `capacity_units` |
| `purchase_requisitions` | `id`, `recommendation_id` (nullable, link to P1), `sku_code`, `dc_code`, `quantity`, `urgency`, `source` (SYSTEM / CHATBOT / MANUAL), `status` |
| `purchase_orders` | `id`, `requisition_id`, `supplier_id`, `quantity`, `unit_price`, `total_amount`, `status` |
| `goods_receipts` | `id`, `po_id`, `received_qty`, `batch_no`, `expiry_date`, `received_at` |
| `invoices` | `id`, `po_id` (nullable, resolved after OCR), `invoice_number`, OCR'd fields, `raw_ocr_json` (jsonb), `status` |
| `three_way_matches` | `id`, `invoice_id`, `po_id`, `grn_id`, `qty_match`, `price_match`, `result`, `mismatch_reason`, `ai_explanation`, `matched_at` |
| `payment_approvals` | `id`, `invoice_id`, `status` (AUTO_APPROVED / PENDING_REVIEW / REJECTED / APPROVED_MANUAL) |

<br>

Full column-level schema is documented in [Section 7 of the project bible](./Documentaion/00_PROJECT_CONTEXT.md).

<br>

---

<br>

## ▎ Live demo flow


<br>

The e2e smoke test automates the following 10-step flow against a live system:

<br>

1. **Login as Planner** &mdash; dashboard shows pre-seeded inventory, expiry heatmap, low-stock alerts.
2. **Trigger demand spike** for a tier-2 SKU (Pune, Cold & Flu) &mdash; P1 recomputes ROP/EOQ &mdash; new Recommendation with AI rationale appears.
3. Recommendation is **auto-sent to PR2** &mdash; switch to Procurement dashboard &mdash; new system-sourced PR appears in realtime.
4. *(Alternative path)* **Chatbot** input &mdash; *"We need 300 units of Amoxicillin for Pune, urgent"* &mdash; Gemini extracts intent &mdash; form pre-fills.
5. **Supplier selection** &mdash; deterministic score breakdown shown &mdash; PO auto-created.
6. **Simulate goods receipt** (one click, batch + expiry).
7. **Upload matching invoice** &mdash; Gemini extracts fields &mdash; three-way match succeeds &mdash; payment auto-approved.
8. **Upload mismatched invoice** (quantity off) &mdash; three-way match fails deterministically &mdash; Exception Queue shows AI explanation of which field and by how much &mdash; procurement officer manually resolves.
9. **P2P analytics dashboard** shows touchless rate, cycle time, full-loop summary.
10. **Close** on the original demand signal &mdash; full P1 → PR2 loop demonstrated end-to-end.

<br>

Run the whole thing programmatically:

```bash
npm run e2e
```

See [`scripts/README_smoke_test.md`](./scripts/README_smoke_test.md) for details.

<br>

---

<br>

## ▎ Testing


<br>

| Layer | Framework | Command |
|---|---|---|
| P1 engines + routes | Vitest | `cd p1-backend && npm test` |
| PR2 backend | JUnit + Spring Boot Test | `cd pr2-backend && mvnw test` |
| End-to-end (full 10-step flow) | tsx + Supertest | `npm run e2e` |

<br>

All four P1 deterministic engines (`demandEngine`, `replenishmentMathEngine`, `fefoEngine`, `expiryRiskEngine`) are unit-tested with deterministic fixtures. AI services are tested against mocked Gemini clients. The e2e suite is gated as a manual `workflow_dispatch` trigger in CI because it requires live Supabase and a Gemini key.

```bash
npm run test:p1
npm run test:pr2
npm run e2e
```

<br>

---

<br>

## ▎ Deployment


<br>

The stack is designed for in-person hackathon judging via local Docker Compose. For a public URL (judges browsing beforehand):

<br>

| Service | Target | Notes |
|---|---|---|
| Frontend | Vercel | Auto-detects Vite; configure `VITE_*` env vars in project settings |
| P1 backend | Render or Railway (free tier, Docker deploy) | One `Dockerfile` per service |
| PR2 backend | Render or Railway (free tier, Docker deploy) | Java 17 runtime |
| Database | Supabase (already hosted) | No action required |

<br>

`frontend/vercel.json` and the root `docker-compose.yml` are pre-wired for these paths.

<br>

---

<br>

## ▎ Design decisions


<br>

| Decision | Choice | Why |
|---|---|---|
| P1 → PR2 handoff mechanism | REST POST to PR2, with a shared `recommendations` table as documented fallback | Keeps the two services independently deployable; one clean integration boundary; no cross-schema FKs. |
| Realtime hub | Socket.IO inside the P1 Node backend, not native WebSockets in Spring Boot | Saves implementation time on the Java side; P1 already hosts the hub for its own low-stock events. |
| OCR | Gemini multimodal as primary, Tesseract.js as fallback | Gemini handles PDF and image natively with no extra dependency; Tesseract covers the case when the free tier is rate-limited. |
| AI model | Gemini 2.0 Flash | Free tier, no billing account; sufficient quality for rationale and document extraction. |
| Auth | Email + password, shared JWT secret across both backends | Simplest setup that satisfies role-gated dashboards; SSO/OAuth out of scope. |
| Database | Single Postgres instance, two logical schemas | Relational integrity needed for PO ↔ GRN ↔ Invoice matching; no NoSQL-shaped problem. |
| Frontend state | Zustand + axios + Socket.IO client | Lightweight; no Redux ceremony. |
| Infra folder naming | `infra/postgres/` and `infra/postgress/` (typo) | Legacy folders preserved for git history; active target is Supabase. |

<br>

---

<br>

## ▎ Documentation index


<br>

| Document | Purpose |
|---|---|
| [`Documentaion/00_PROJECT_CONTEXT.md`](./Documentaion/00_PROJECT_CONTEXT.md) | **Project bible.** Architecture, schema, build plan, 5-day roadmap. |
| [`Documentaion/CHAINVISION_MASTER_CHECKLIST.md`](./Documentaion/CHAINVISION_MASTER_CHECKLIST.md) | Phase-by-phase task checklist with status. |
| [`Documentaion/PROMPTS.md`](./Documentaion/PROMPTS.md) | Archive of AI dev prompts used to build this project. |
| [`shared/contracts/README.md`](./shared/contracts/README.md) | P1 → PR2 handoff contract description. |
| [`shared/seed-data/README_p1.md`](./shared/seed-data/README_p1.md), [`README_pr2.md`](./shared/seed-data/README_pr2.md) | Seed scripts documentation. |
| [`pr2-backend/SETUP.md`](./pr2-backend/SETUP.md) | Detailed PR2 backend setup. |
| [`scripts/README_smoke_test.md`](./scripts/README_smoke_test.md) | E2E smoke test instructions. |
| [`scripts/README_invoice_demo.md`](./scripts/README_invoice_demo.md) | Invoice PDF generation script. |

<br>

---

<br>

## ▎ Hackathon


<br>

| | |
|---|---|
| **Event** | Cognizant NPN_SCM Hackathon 2026 |
| **Combination** | 4 &mdash; P1 (Demand Sensing & Replenishment) + PR2 (Autonomous Procure-to-Pay) |
| **Persona** | MedCare Pharma, multi-DC pharma distributor |
| **Team constraint** | PR2 backend in Java + Spring Boot (team skill profile); P1 backend in Node + Express; frontend in React + Vite + TypeScript |
| **AI budget** | Google Gemini free tier (no paid key, no billing account) |
| **License** | Internal &mdash; not licensed for redistribution |

<br>

---

<br>

<sub>Built in 5 days. The full project context, architecture, schema, and build plan live in [Documentaion/00_PROJECT_CONTEXT.md](./Documentaion/00_PROJECT_CONTEXT.md).</sub>
