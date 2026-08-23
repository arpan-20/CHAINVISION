# CHAINVISION

**Integrated Supply Chain Intelligence Platform** — built for the NPN_SCM Hackathon 2026 (Cognizant), Combination 4.

CHAINVISION connects two supply-chain use cases into a single, continuous, end-to-end flow instead of building them as two disconnected demos:

- **P1 — Demand Sensing & Replenishment Planning:** watches demand and inventory (with batch/expiry awareness) for a pharma distributor, *MedCare Pharma*, and deterministically decides what needs to be reordered, how much, and how urgently.
- **PR2 — End-to-End Autonomous Procure-to-Pay:** takes that replenishment need and automates the entire purchasing lifecycle — requisition, supplier selection, PO creation, goods receipt, invoice OCR, 3-way match, and payment approval — with a human only in the loop for exceptions.

> **The pitch:** *A stockout risk is detected by demand sensing at 9:00am. By 9:05am, a purchase requisition has been auto-generated, a supplier selected, a PO sent, goods simulated as received, an invoice OCR'd and 3-way matched, and payment auto-approved — with a human only needed for the exceptions.*

The P1 → PR2 handoff is the project's core differentiator: the two use cases are built as independently deployable services with one clean integration boundary, so they can be developed in parallel and demoed as one story.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [The Deterministic-Core / AI-at-the-Edges Rule](#the-deterministic-core--ai-at-the-edges-rule)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Seed Data & Demo Accounts](#seed-data--demo-accounts)
- [Demo Flow](#demo-flow)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Definition of Done](#definition-of-done)
- [Project Documentation](#project-documentation)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                     │
│   - Planner Dashboard (P1)      - Procurement Dashboard (PR2)    │
│   - Realtime updates via Supabase Realtime                       │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ REST + JWT                    │ REST + JWT
                ▼                                ▼
┌───────────────────────────┐      ┌───────────────────────────────┐
│  P1 Backend (Node/Express) │      │  PR2 Backend (Java/SpringBoot) │
│  - Deterministic calc      │─────▶│  - Requisition                 │
│    engine (demand, safety  │ REST │  - Supplier selection          │
│    stock, EOQ, ROP, FEFO,  │ POST │  - PO generation                │
│    expiry risk)            │      │  - GRN                          │
│  - Recommendation generator│      │  - Invoice OCR (Tesseract +     │
│  - AI rationale generation │      │    Gemini structuring)          │
│                             │      │  - 3-way match engine           │
│                             │      │  - Exception handling           │
└──────────────┬──────────────┘      └───────────────┬─────────────┘
                │                                     │
                ▼                                     ▼
       ┌────────────────────────────────────────────────────┐
       │        Supabase (managed Postgres + Auth)           │
       │        schemas: `p1` and `pr2`                       │
       └────────────────────────────────────────────────────┘

  External: Google Gemini API (free tier) — used only for:
  (1) NL requisition intent extraction, (2) rationale/explanation
  text generation, (3) structuring raw OCR text into JSON fields.
```

**P1 → PR2 handoff:** when P1's deterministic engine determines an SKU/DC combination needs replenishment (urgency ≥ MEDIUM), it emits a `ReplenishmentRecommendation` object and calls `POST {PR2_BASE_URL}/api/requisitions/from-recommendation`. PR2 creates a `purchase_requisitions` row with `source = SYSTEM`. This is the single most important integration point in the system — the two services otherwise develop and deploy independently.

**Realtime:** both dashboards subscribe directly to Postgres change events via Supabase Realtime (`supabase-js`), so recommendations, requisitions, POs, invoices, and payment approvals appear live on screen without polling.

---

## Tech Stack

Kept intentionally simple and fast to implement for a 5-day build — no Kubernetes, no microservices-for-the-sake-of-it.

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + TypeScript, Tailwind CSS, Recharts, Axios, `@supabase/supabase-js` |
| P1 Backend | Node.js + Express (TypeScript) |
| PR2 Backend | Java 17 + Spring Boot (Maven) — mandated by team skill constraint |
| Database | Supabase-hosted PostgreSQL — one project, two logical schemas: `p1` and `pr2` |
| Auth | Supabase Auth (email + password), JWT verified independently by both backends |
| Realtime | Supabase Realtime (Postgres change-data-capture) |
| AI | Google Gemini API (`gemini-2.0-flash`) — free tier |
| OCR | Tesseract.js (primary, hosted on the P1/Node backend) → Gemini (structures raw OCR text into JSON) |
| Deployment | Docker Compose (local/demo); optional Render/Railway for a public judge-facing URL |

## The Deterministic-Core / AI-at-the-Edges Rule

This is the project's central design principle, and it is enforced by code review, not just by testing:

> **AI/LLM APIs must never perform core numeric or business calculations.**

Demand calculation, safety stock, reorder point, EOQ, FEFO sequencing, expiry-risk scoring, supplier scoring, and 3-way matching are all implemented as plain, deterministic, unit-tested code. Gemini is used for exactly three things, and nothing else:

1. **NL requisition intent extraction** — parses free-text ("We need 500 units of Paracetamol 500mg for the Kolkata DC") into a structured guess that a human must confirm before it becomes a real requisition.
2. **Rationale / explanation text** — after the deterministic engine has already computed a number, Gemini is asked only to phrase it in plain English (recommendation rationale; 3-way-match mismatch explanations).
3. **OCR-text-to-JSON structuring** — turns raw Tesseract OCR text into structured invoice fields. It never sees PO/GRN data and never makes the match decision.

No AI output ever feeds directly into a quantity, threshold, or decision field.

---

## Folder Structure

```
chainvision/
├── 00_PROJECT_CONTEXT.md      # single source of truth: requirements, schema, contracts
├── PROMPTS.md                  # multi-agent build plan (45 prompts / 28 phases)
├── docker-compose.yml
├── .env.example
│
├── frontend/                   # React + Vite + TS
│   └── src/
│       ├── pages/planner/      # P1 dashboard views
│       ├── pages/procurement/  # PR2 dashboard views
│       ├── components/
│       ├── hooks/              # useAuth, useRealtimeTable, etc.
│       └── api/                # axios clients (p1Client, pr2Client)
│
├── p1-backend/                 # Node + Express + TS — Demand & Replenishment
│   └── src/
│       ├── engine/             # pure, deterministic calc: demand, safetyStock, eoq, rop, fefo, expiryRisk
│       ├── routes/
│       ├── services/           # recommendationService, aiRationaleService, pr2ClientService
│       ├── db/                 # Supabase client
│       └── auth/                # JWT verification
│
├── pr2-backend/                # Java + Spring Boot — Procure-to-Pay
│   └── src/main/java/com/chainvision/pr2/
│       ├── requisition/
│       ├── sourcing/           # deterministic supplier scoring
│       ├── purchaseorder/
│       ├── goodsreceipt/
│       ├── invoice/            # OcrClient, InvoiceStructuringService, ThreeWayMatchEngine
│       ├── payment/
│       └── security/           # Supabase JWT verification
│
├── shared/
│   ├── contracts/               # the P1→PR2 handoff object (JSON Schema + Java DTO mirror)
│   └── seed-data/                # seed scripts + generated synthetic datasets, sample invoices
│
├── infra/
│   └── supabase/migrations/     # versioned SQL migrations for the p1/pr2 schemas
│
└── scripts/                     # e2e smoke test, demo reset script
```

---

## Getting Started

### Prerequisites

- Node.js (LTS)
- Java 17 + Maven
- Docker & Docker Compose
- A [Supabase](https://supabase.com) project (free tier is sufficient)
- A free [Google Gemini API key](https://aistudio.google.com/apikey) (no billing account required)

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd chainvision

# 2. Copy the environment template and fill in real values
cp .env.example .env
# — fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, etc.

# 3. Apply the Supabase schema
# Run the migrations in /infra/supabase/migrations/ in order, via the Supabase SQL editor
# or the Supabase CLI. See /infra/supabase/README.md for exact steps.

# 4. Seed the database
node shared/seed-data/p1_seed.ts
node shared/seed-data/pr2_seed.ts

# 5. Bring the whole system up
docker compose up
```

The frontend will be available at `http://localhost:5173`, the P1 backend at `http://localhost:4000`, and the PR2 backend at `http://localhost:8080`.

---

## Environment Variables

All variables live in `.env` (copy from `.env.example`); no secrets are ever committed to the repo. Key groups:

| Group | Variables |
|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| P1 backend | `P1_PORT`, `PR2_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `INTERNAL_API_KEY` |
| PR2 backend | `PR2_PORT`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `P1_OCR_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Frontend | `VITE_P1_API_BASE`, `VITE_PR2_API_BASE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

`GEMINI_API_KEY` should never be hardcoded — both backends read it from the environment only, and both wrap Gemini calls with retry/backoff to handle the free tier's rate limits gracefully.

---

## Seed Data & Demo Accounts

The database is seeded with fully synthetic data so the dashboards are demo-ready on first load:

- **P1:** 15–20 SKUs across antibiotics/analgesics/cold-flu categories, 4–6 Distribution Centers (Tier-1 and Tier-2), inventory batches with a spread of expiry dates (including near-expiry and critical), 90 days of demand history plus a seasonal +60% spike scenario, and 3–5 SKU/DC combos deliberately seeded below reorder point.
- **PR2:** 6–10 suppliers with varied price/lead-time/OTD/quality scores (including one "cheap but unreliable" and one "expensive but reliable"), a handful of pre-existing POs/GRNs in different states, and 3 sample invoices (one clean match, one quantity mismatch, one price mismatch).

Demo accounts (seeded, password `demo1234`):

| Email | Role |
|---|---|
| `planner@demo.com` | PLANNER |
| `procurement@demo.com` | PROCUREMENT_OFFICER |
| `admin@demo.com` | ADMIN |

---

## Demo Flow

1. Log in as **Planner** → see current inventory, expiry-risk heatmap, and active low-stock alerts (pre-seeded).
2. Trigger a **demand spike simulation** for a Tier-2 SKU → deterministic engine recomputes ROP/EOQ → a new **Replenishment Recommendation** appears live, with an AI-generated rationale.
3. The recommendation is automatically sent to PR2 → switch to the **Procurement Dashboard** → the new system-generated **Purchase Requisition** appears live.
4. Optionally demo the **chatbot path**: type a free-text request → Gemini extracts structured intent → pre-fills a confirm form.
5. **Supplier selection** runs deterministically → a **PO** is auto-created, with the price/lead-time/OTD/quality score breakdown shown.
6. **Simulate goods receipt** against the PO (one click).
7. **Upload an invoice** → Gemini structures the OCR'd text into fields.
8. Run **3-way match** → MATCHED → payment **auto-approved**, live on the P2P analytics dashboard.
9. Upload a **mismatched invoice** → 3-way match fails deterministically → lands in the **Exception Queue** with a Gemini-generated plain-English explanation → resolved manually.
10. Close on the **P2P analytics dashboard**: touchless-processing rate, cycle time, full loop shown back to the original demand signal.

---

## API Overview

### P1 Backend (`/api`, port 4000)

```
POST   /api/auth/login
GET    /api/skus
GET    /api/distribution-centers
GET    /api/inventory
POST   /api/demand-signals
GET    /api/demand-signals
GET    /api/replenishment/recommendations
POST   /api/replenishment/recalculate
GET    /api/replenishment/recommendations/:id
```

### PR2 Backend (`/api`, port 8080)

```
POST   /api/requisitions
POST   /api/requisitions/from-recommendation
POST   /api/requisitions/parse-intent
GET    /api/requisitions
GET    /api/suppliers
POST   /api/purchase-orders/{requisitionId}
GET    /api/purchase-orders
POST   /api/goods-receipts
POST   /api/invoices/upload
POST   /api/invoices/{id}/match
GET    /api/exceptions
POST   /api/exceptions/{id}/resolve
GET    /api/analytics/p2p-summary
```

---

## Testing

- **Deterministic engines** (P1: demand, expiry risk, FEFO, safety stock/ROP/EOQ; PR2: supplier scoring, 3-way match) are pure functions with dedicated unit test suites — no database or AI dependency required to run them.
- **Integration tests** cover the full P1 REST surface and the live P1 → PR2 handoff.
- **`scripts/e2e_smoke_test.ts`** runs the entire 10-step demo flow against the live, deployed system and asserts expected state after each step.

```bash
# P1 backend
cd p1-backend && npm test

# PR2 backend
cd pr2-backend && mvn test

# Full end-to-end smoke test (requires the whole system running)
node scripts/e2e_smoke_test.ts
```

---

## Definition of Done

A feature is considered done only when:

- Deterministic calculations have no AI call in their code path and produce reproducible output.
- The P1 → PR2 handoff works end-to-end with no manual intervention.
- Both dashboards reflect state changes in realtime.
- Gemini is used only for intent extraction, rationale text, and OCR structuring — verified by code review.
- Authentication and role-gating work for all three roles, enforced server-side.
- Seed data loads cleanly and produces a non-empty, demo-ready dashboard on first run.
- The full 10-step demo flow runs live without manual database edits.
- `docker compose up` brings up all services successfully on a clean machine.
- No secrets are committed to source control.

---

## Project Documentation

- **[`00_PROJECT_CONTEXT.md`](./00_PROJECT_CONTEXT.md)** — the single source of truth: full requirements, exact schema, API contracts, and the 5-day build plan.
- **[`PROMPTS.md`](./PROMPTS.md)** — the multi-agent execution backlog (45 prompts / 28 phases) and the 15-account parallel build plan used to construct this repository.
- **`INTEGRATION_BUG_BASH.md`**, **`DEMO_SCRIPT.md`**, **`PRESENTATION_OUTLINE.md`** — generated during the final integration and demo-prep phases; see the repo root once available.

---

Built for **NPN_SCM Hackathon 2026** by Team CHAINVISION.
