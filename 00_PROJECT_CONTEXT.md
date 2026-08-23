# 00_PROJECT_CONTEXT.md
## CHAINVISION — Integrated Supply Chain Intelligence Platform

**Hackathon:** NPN_SCM Hackathon 2026 (Cognizant)
**Combination:** Combination 4 → P1 (Demand Sensing & Replenishment Planning) + PR2 (End-to-End Autonomous Procure-to-Pay)
**Document purpose:** This is the single source of truth for the project. Any engineer (human or AI) should be able to read this file alone and understand what we are building, why, and how — without needing any other conversation history.

---

## 1. Project Overview

**CHAINVISION** is an integrated supply chain platform that connects two hackathon use cases into one continuous, end-to-end business flow instead of building them as two disconnected demos.

- **P1 (Demand Sensing & Replenishment Planning)** watches demand and inventory (with expiry/batch awareness) for a pharma distributor ("MedCare Pharma") and decides **what needs to be reordered, how much, and how urgently**.
- **PR2 (Procure-to-Pay / P2P)** takes that replenishment need and **automates the entire purchasing lifecycle** — requisition, supplier selection, PO creation, goods receipt, invoice OCR, 3-way match, and payment approval — with minimal human touch.

The core narrative/demo pitch: *"A stockout risk is detected by AI-assisted demand sensing at 9:00am. By 9:05am, a purchase requisition has been auto-generated, a supplier has been selected, a PO has been sent, goods have been simulated as received, an invoice has been OCR'd and 3-way matched, and payment has been auto-approved — with a human only needed for the exceptions."*

This integration (P1 → PR2) is exactly the "Combination 4" pairing assigned by the hackathon (see source deck), and is the differentiator vs. teams who build the two use cases as isolated silos.

**Explicit constraint from stakeholder:** Do not reuse or reference any older/previous project plans. This document supersedes all prior versions.

---

## 2. P1 Requirements — Demand Sensing & Replenishment Planning

**Business context (from hackathon brief):** MedCare Pharma faces flu-season demand spikes (~+60%) causing stockouts of critical SKUs in Tier-2 cities, while metro Distribution Centers (DCs) sit on excess near-expiry stock. Siloed regional warehouses and expiry-blind allocation cause both wastage and lost sales.

**Functional requirements:**
1. Ingest historical + sensed demand signals (by SKU, by region/DC).
2. Maintain current inventory with **batch-level expiry data**.
3. Maintain warehouse capacity and lead-time data per DC.
4. Compute, deterministically (see Section 5.1):
   - Demand forecast / sensed demand adjustment
   - Safety stock
   - Reorder Point (ROP)
   - Economic Order Quantity (EOQ) / replenishment quantity
   - FEFO (First-Expiry-First-Out) allocation sequencing
   - Expiry risk scoring per batch
5. Detect SKUs that have breached reorder point or are at stockout risk.
6. Generate a **Replenishment Recommendation** object per SKU/DC that becomes the trigger into PR2.
7. Provide a dashboard: current stock, expiry risk heatmap, reorder alerts, replenishment recommendations, and (via AI) a human-readable rationale for each recommendation.
8. Support a review/escalation view for shortage situations.

**Explicit exclusions:** P1 does NOT decide which supplier to use, does NOT create POs, and does NOT touch invoices/payments — that is all PR2's job. P1's output is a **recommendation**, not a procurement action.

---

## 3. PR2 Requirements — End-to-End Autonomous Procure-to-Pay (P2P)

**Business context (from hackathon brief):** A fully autonomous, touchless P2P platform for high-volume enterprise usage, addressing bottlenecks using conversational NLP, intelligent OCR, and predictive anomaly detection.

**Functional requirements, per the four P2P stages:**

1. **Requisition**
   - Accept a replenishment need either (a) automatically from P1's Replenishment Recommendation, or (b) via a conversational/natural-language chatbot input from a user ("We need 500 units of Paracetamol 500mg for the Kolkata DC").
   - AI API extracts structured intent (SKU, quantity, urgency, DC) from free-text input — **AI is only used for parsing intent, not for computing quantities**.
   - System creates a formal **Purchase Requisition (PR)** record.

2. **Sourcing & PO**
   - Evaluate approved supplier list against price, lead time, capacity, and performance score (OTD/Quality) using deterministic rules (weighted scoring — not an LLM decision).
   - Auto-select best supplier and auto-generate a **Purchase Order (PO)**.

3. **Receiving**
   - Simulate goods receipt (no real IoT/Computer Vision hardware — this is mocked/simulated data entry or a simple "Mark as Received" action that generates a **Goods Receipt Note (GRN)** with received quantity, batch, and expiry date).

4. **Invoicing**
   - Accept an uploaded invoice (PDF/image).
   - **OCR extracts** invoice fields: PO number, item, quantity, unit price, total, invoice number, vendor.
   - System performs deterministic **3-Way Match**: PO vs GRN vs Invoice (quantity + price tolerance rules).
   - On match → **auto-approve** payment.
   - On mismatch → route to **Exception Queue** for human review, with AI-generated plain-English explanation of *why* it failed to match.

**Additional requirement:** A P2P analytics dashboard showing touchless-processing rate, PRs/POs/invoices in flight, exception rate, and cycle time.

**Team constraint:** The **backend for PR2 must be built in Java** (Spring Boot) because the assigned team members are proficient in Java. P1's backend does not have this constraint (see Section 5).

---

## 4. P1 → PR2 Integration (Core Integrated Flow)

This is the single most important architectural concept in CHAINVISION — it is what makes this one project instead of two:

```
Demand Signal
   → Inventory Analysis
   → Expiry Analysis
   → FEFO
   → Replenishment Recommendation      [END OF P1]
   → Send to Procurement                [P1 → PR2 HANDOFF]
   → Purchase Requisition                [START OF PR2]
   → Supplier Selection
   → Purchase Order
   → Goods Receipt
   → Invoice OCR
   → 3-Way Match
   → Payment Approval / Exception       [END OF PR2]
```

**Handoff contract (P1 → PR2):** When P1's engine determines an SKU/DC combination requires replenishment, it emits a `ReplenishmentRecommendation` event/record containing at minimum:
```
{
  "recommendationId": "string",
  "skuId": "string",
  "skuName": "string",
  "dcId": "string",
  "recommendedQty": number,          // from EOQ/ROP logic
  "urgency": "LOW | MEDIUM | HIGH | CRITICAL",
  "reason": "string",                // deterministic reason code
  "aiRationale": "string",           // AI-generated human-readable explanation
  "expiryRiskContext": "string",
  "generatedAt": "ISO-8601 timestamp"
}
```
This record is picked up by PR2 (via REST call or shared DB table — see Section 8 for the recommended simple integration pattern) and becomes the seed of a new Purchase Requisition automatically ("system-generated requisition"), running in parallel with the conversational/manual requisition path.

**Design principle:** P1 and PR2 remain independently deployable services/modules with one clean integration boundary (the recommendation object), so each sub-team can build in parallel without blocking each other.

---

## 5. Exact Technology Stack

Kept intentionally simple/"boring" and fast-to-implement given the 5-day build window. No Kubernetes, no microservices-for-the-sake-of-it, no exotic infra.

### 5.1 Core Business Logic Rule (applies to entire stack)
> **AI/LLM APIs must NEVER perform core numeric/business calculations.**
> Demand calculation, safety stock, EOQ, reorder point, FEFO sequencing, and expiry risk scoring must all be implemented as **plain deterministic code** (arithmetic/rules), unit-testable, and reproducible. AI is used only for (a) natural-language requisition intent extraction and (b) generating human-readable rationale/explanation text after the deterministic engine has already produced the numeric answer.

### 5.2 Frontend
- **React (Vite) + TypeScript**
- **Tailwind CSS** for styling (fast to implement, no design system overhead)
- **Recharts** for dashboards (inventory levels, expiry heatmap, P2P funnel/cycle time)
- **Axios** for API calls
- **Socket.IO client** (or plain polling fallback) for realtime alerts
- Rationale: React+Vite is the fastest path from zero to a working demo UI; Tailwind avoids CSS overhead; Recharts covers all chart types needed (bar, line, heatmap-via-grid).

### 5.3 Backend

| Module | Stack | Rationale |
|---|---|---|
| **P1 (Demand Sensing & Replenishment)** | **Node.js + Express (TypeScript)** | Fast to scaffold, same language family as frontend, good for JSON-heavy deterministic calc services and quick REST endpoints. |
| **PR2 (Procure-to-Pay)** | **Java + Spring Boot** (Java 17, Maven) | **Mandated by team skill constraint.** Spring Boot gives batteries-included REST, validation, and easy integration with Spring Data JPA for the P2P entities (PR, PO, GRN, Invoice). |
| **Integration layer** | Simple **REST call** from P1 → PR2 (`POST /api/pr2/requisitions/from-recommendation`) OR a shared **recommendations** table PR2 polls — pick REST call as primary, shared-table as fallback if time-constrained (see Section 8). |

### 5.4 Database
- **PostgreSQL** (single shared instance, two logical schemas: `p1` and `pr2`, or two databases if teams prefer full isolation)
- Rationale: relational integrity matters here (PO ↔ GRN ↔ Invoice matching, SKU/batch/expiry tracking) — this is not a NoSQL-shaped problem. Postgres is free, well supported by both Node (Prisma/Sequelize) and Java (Spring Data JPA/Hibernate), and trivial to run locally via Docker.
- **ORM:** Prisma (P1/Node side), Hibernate/Spring Data JPA (PR2/Java side)

### 5.5 Authentication
- **JWT-based auth**, issued by a single lightweight **Auth service** (can live inside the Node/P1 backend for simplicity, or as its own small Express service) shared by both frontends.
- Roles: `PLANNER` (P1 dashboard), `PROCUREMENT_OFFICER` (PR2 dashboard/exceptions), `ADMIN` (both + demo controls).
- Password hashing: **bcrypt**.
- No need for full OAuth/SSO — out of scope for a 5-day hackathon. Keep it to email+password + JWT.

### 5.6 Realtime
- **Socket.IO** (Node side) for pushing: low-stock alerts, new replenishment recommendations, PO status changes, exception-queue updates.
- Java/Spring Boot side exposes a lightweight **webhook/REST callback** to the Node realtime hub whenever a PR2 state change occurs (PO created, invoice matched, exception raised) — Node then broadcasts it over Socket.IO to connected dashboards. This avoids needing to implement WebSockets natively in Spring Boot, saving time.

### 5.7 AI
- **Google Gemini API** (`gemini-2.0-flash` — always specify explicitly, do not assume a default model) via the Gemini REST API / `google-genai` SDK. Chosen because it has a **free tier** (no paid API key required), which is a hard budget constraint for this hackathon.
- Used strictly for the two scoped responsibilities in Sections 9 (see below) — **never for numeric computation**.
- Structured outputs: prompt Gemini to return JSON only (no markdown fences, no preamble) for intent-extraction calls, and/or use Gemini's native `responseMimeType: "application/json"` / `responseSchema` structured-output mode where available; parse defensively with try/catch and fallback to a manual-entry form if parsing fails.

### 5.8 OCR
- **Tesseract.js** (Node/JS-based OCR) for simplicity if invoices are simulated as clean digital PDFs/images — fastest to wire up, no external account needed, and fully free/local (good fallback if API quota is a concern).
- Alternative (higher quality, still fast to implement, still free-tier): send the invoice image/PDF to the **Gemini API using multimodal/document input** (Gemini accepts PDFs and images directly as inline data or file uploads) and prompt it to extract structured invoice fields as JSON. **Recommended primary approach** — it removes an extra dependency (Tesseract) and Gemini's document understanding is more robust for messy layouts than plain OCR, especially given the short build window, while staying within the free tier.
- **Decision:** Use **Gemini API multimodal/document input** as the OCR mechanism (Section 10 clarifies this is data extraction, not calculation, so it is within allowed AI scope).

### 5.9 Deployment
- **Docker Compose** for local/demo deployment: one container each for `frontend`, `p1-backend` (Node), `pr2-backend` (Java/Spring Boot), `postgres`.
- No cloud deployment required for the hackathon judging (in-person demo per the hackathon deck), but if a public URL is wanted for judges to browse beforehand: **Render.com** or **Railway.app** (both support Docker deploys with minimal config, free/cheap tiers, fastest path to a public URL without DevOps overhead).
- Rationale: Docker Compose is the "easy to implement" choice that also satisfies the evaluation criterion "Deployment and Integration – use of CI/CD pipelines, cloud deployment strategies" without requiring Kubernetes-level complexity.

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                     │
│   - Planner Dashboard (P1)      - Procurement Dashboard (PR2)    │
│   - Realtime alerts via Socket.IO client                         │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ REST + JWT                    │ REST + JWT
                ▼                                ▼
┌───────────────────────────┐      ┌───────────────────────────────┐
│  P1 Backend (Node/Express) │      │  PR2 Backend (Java/SpringBoot) │
│  - Deterministic calc      │─────▶│  - Requisition                 │
│    engine (demand, safety  │ REST │  - Supplier selection          │
│    stock, EOQ, ROP, FEFO,  │ POST │  - PO generation                │
│    expiry risk)            │      │  - GRN                          │
│  - Recommendation generator│      │  - Invoice OCR (via Gemini)     │
│  - AI rationale generation │      │  - 3-way match engine           │
│  - Socket.IO realtime hub  │◀─────│  - Exception handling           │
│    (also relays PR2 events)│ CB   │  - Webhook callback to Node hub │
└──────────────┬──────────────┘      └───────────────┬─────────────┘
                │                                     │
                ▼                                     ▼
       ┌───────────────────┐               ┌────────────────────┐
       │ PostgreSQL: p1     │               │ PostgreSQL: pr2     │
       │ schema             │               │ schema              │
       └───────────────────┘               └────────────────────┘
                        \                     /
                         \                   /
                     Shared/Single Postgres instance

        External: Google Gemini API — free tier (intent extraction,
        rationale generation, invoice document OCR/extraction)
```

CB = webhook callback (PR2 → Node hub) used purely to push realtime events to the frontend; it carries no business logic.

---

## 7. Database Schema

Two logical schemas in one Postgres instance: `p1` and `pr2`. Keys referencing across schemas (e.g., `pr2.purchase_requisitions.recommendation_id`) are stored as plain UUID/string foreign references (not enforced cross-schema FK, since these are two independently deployable services).

### 7.1 Schema `p1`

**`skus`**
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| sku_code | text | unique |
| name | text | |
| category | text | |
| unit_cost | numeric | |
| lead_time_days | int | |

**`distribution_centers`**
| id | UUID PK |
| dc_code | text | |
| name | text | |
| region | text | tier-1/tier-2 city classification |
| capacity_units | int | |

**`inventory_batches`**
| id | UUID PK |
| sku_id | FK → skus |
| dc_id | FK → distribution_centers |
| batch_no | text | |
| quantity | int | |
| expiry_date | date | |
| received_date | date | |

**`demand_signals`**
| id | UUID PK |
| sku_id | FK |
| dc_id | FK |
| signal_date | date |
| historical_demand | int |
| sensed_adjustment_pct | numeric | e.g. +60 for flu season |
| source | text | e.g. 'historical', 'promo_calendar', 'seasonal' |

**`replenishment_recommendations`**
| id | UUID PK |
| sku_id | FK |
| dc_id | FK |
| recommended_qty | int |
| reorder_point | numeric |
| safety_stock | numeric |
| eoq | numeric |
| urgency | enum(LOW, MEDIUM, HIGH, CRITICAL) |
| reason_code | text | deterministic reason |
| ai_rationale | text | Gemini-generated explanation |
| status | enum(NEW, SENT_TO_PROCUREMENT, ACKNOWLEDGED) |
| created_at | timestamp |

### 7.2 Schema `pr2`

**`suppliers`**
| id | UUID PK |
| name | text |
| price_index | numeric | relative cost score |
| avg_lead_time_days | int |
| otd_score | numeric | on-time-delivery % |
| quality_score | numeric |
| capacity_units | int |

**`purchase_requisitions`**
| id | UUID PK |
| recommendation_id | text nullable | link back to p1.replenishment_recommendations.id, null if manually raised |
| sku_code | text |
| dc_code | text |
| quantity | int |
| urgency | text |
| source | enum(SYSTEM, CHATBOT, MANUAL) |
| raw_nl_input | text nullable | original free-text request if via chatbot |
| status | enum(CREATED, SOURCED, PO_RAISED) |
| created_at | timestamp |

**`purchase_orders`**
| id | UUID PK |
| requisition_id | FK |
| supplier_id | FK |
| quantity | int |
| unit_price | numeric |
| total_amount | numeric |
| status | enum(ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED) |
| created_at | timestamp |

**`goods_receipts`**
| id | UUID PK |
| po_id | FK |
| received_qty | int |
| batch_no | text |
| expiry_date | date |
| received_at | timestamp |

**`invoices`**
| id | UUID PK |
| po_id | FK nullable | resolved after OCR match attempt |
| invoice_number | text |
| vendor_name_ocr | text |
| quantity_ocr | int |
| unit_price_ocr | numeric |
| total_ocr | numeric |
| raw_ocr_json | jsonb | full extracted payload |
| uploaded_file_ref | text |
| status | enum(PENDING_MATCH, MATCHED, MISMATCHED, APPROVED, EXCEPTION) |
| created_at | timestamp |

**`three_way_matches`**
| id | UUID PK |
| invoice_id | FK |
| po_id | FK |
| grn_id | FK |
| qty_match | boolean |
| price_match | boolean |
| result | enum(MATCHED, MISMATCHED) |
| mismatch_reason | text nullable |
| ai_explanation | text nullable | Gemini-generated plain-English explanation on mismatch |
| matched_at | timestamp |

**`payment_approvals`**
| id | UUID PK |
| invoice_id | FK |
| status | enum(AUTO_APPROVED, PENDING_REVIEW, REJECTED, APPROVED_MANUAL) |
| approved_by | text nullable |
| approved_at | timestamp nullable |

**`users`** (shared auth table — can also live in a dedicated `auth` schema)
| id | UUID PK |
| email | text unique |
| password_hash | text |
| role | enum(PLANNER, PROCUREMENT_OFFICER, ADMIN) |

---

## 8. Realtime Design

**Hub:** Socket.IO server hosted inside the P1 Node backend (`/realtime` namespace). Chosen as the single hub to avoid implementing native WebSocket support in Spring Boot under time pressure.

**Events emitted:**
| event | payload | triggered by |
|---|---|---|
| `low_stock_alert` | sku, dc, currentQty, threshold | P1 deterministic engine |
| `replenishment_recommendation_created` | full recommendation object | P1 engine |
| `requisition_created` | requisition summary | PR2 → webhook → Node hub |
| `po_issued` | PO summary | PR2 → webhook → Node hub |
| `invoice_uploaded` | invoice id, status | PR2 → webhook → Node hub |
| `three_way_match_result` | MATCHED/MISMATCHED + reason | PR2 → webhook → Node hub |
| `payment_status_changed` | invoice id, new status | PR2 → webhook → Node hub |

**PR2 → Node integration mechanism:** PR2 (Spring Boot) makes a simple authenticated `POST` to an internal endpoint on the P1/Node backend, e.g. `POST /internal/realtime/emit`, with `{ event, payload }`. Node relays it to all connected Socket.IO clients. This keeps Spring Boot free of WebSocket implementation work.

**P1 → PR2 integration mechanism (the main data handoff, distinct from the realtime layer):** When P1's engine creates a `replenishment_recommendation` with urgency ≥ MEDIUM, P1 backend calls:
`POST {PR2_BASE_URL}/api/requisitions/from-recommendation` with the recommendation payload (see Section 4 contract). PR2 creates a `purchase_requisitions` row with `source = SYSTEM`.

**Frontend polling fallback:** If Socket.IO integration runs short on time, both dashboards can fall back to a 5–10 second polling interval on the relevant list endpoints — flagged in code as a `TODO` fallback, not the primary design.

---

## 9. AI API Responsibilities (Google Gemini API)

AI is deliberately scoped to **exactly two responsibilities**, per explicit project constraint. It must never be the source of a quantity, threshold, score, or match decision. Gemini is used (instead of a paid model) specifically because it offers a **free-tier API key**, which fits the project's zero-budget constraint.

1. **Natural-language requisition intent extraction (PR2, Requisition stage)**
   - Input: free-text chatbot message from a user (e.g., "We're running low on amoxicillin in the Pune warehouse, need about 300 units urgently").
   - Gemini call returns **structured JSON only**: `{ skuGuess, quantity, dcGuess, urgency, confidence }` (ideally via Gemini's structured-output/`responseSchema` mode for reliability).
   - This structured output pre-fills a requisition form for human confirmation (or, if confidence is high and demo mode allows, auto-creates the requisition) — it never silently bypasses deterministic downstream logic.

2. **Human-readable rationale / explanation generation**
   - **P1 side:** after the deterministic engine computes a replenishment recommendation (qty, urgency, reason code), Gemini is given the *already-computed* numbers and asked to phrase a one-paragraph rationale for the dashboard, e.g., "Recommending 500 units for Pune DC — current stock covers 3 days against a 60% seasonal demand spike, and the reorder point (420 units) has been breached."
   - **PR2 side:** when a 3-way match fails, Gemini is given the deterministic mismatch details (which field, expected vs actual, tolerance) and asked to phrase a plain-English explanation for the exception queue, e.g., "Invoice quantity (480) does not match goods received (500) — a 20-unit shortfall exceeds the 2% tolerance."

**Hard rule for implementation:** every Gemini prompt used for rationale generation must receive the final computed numbers as input variables — Gemini is only ever asked to *describe*, never to *derive*.

---

## 10. OCR Responsibilities

- **Scope:** Extracting structured fields from an uploaded invoice document (PDF or image) during the PR2 Invoicing stage only.
- **Mechanism:** Gemini API multimodal input (send the invoice as base64 PDF or image inline data, or via the Files API for larger documents, alongside a prompt instructing extraction of: invoice number, PO number (if printed on invoice), line items (SKU/description, quantity, unit price), total amount, vendor name). Prompt Gemini to return **JSON only**, ideally using `responseMimeType: "application/json"`.
- **What OCR does NOT do:** OCR/Gemini does not decide whether the invoice matches the PO/GRN — that decision is 100% deterministic code (see 3-way match logic in Section 7.2 `three_way_matches` and Section 4). OCR's job ends at "here is the structured data extracted from this document."
- **Fallback:** if Gemini document extraction proves unreliable for a given sample invoice format during testing, fall back to Tesseract.js + a simple regex/field-position parser as a backup path — Gemini multimodal extraction remains the primary plan since it needs no extra library, supports PDF/image input natively, and stays within the free tier.

---

## 11. Authentication

- **Mechanism:** Email + password, JWT issued on login, stored in frontend memory/localStorage (acceptable for hackathon demo scope), attached as `Authorization: Bearer <token>` on all API calls.
- **Service:** Hosted as part of the P1/Node backend (`/api/auth/login`, `/api/auth/register`) to avoid standing up a third service. PR2 (Java) validates the same JWT using a shared secret (`JWT_SECRET` env var) — no need for a separate Java auth implementation, just JWT verification middleware in Spring Security.
- **Roles:** `PLANNER`, `PROCUREMENT_OFFICER`, `ADMIN` — used to gate dashboard routes and to label who approved manual exceptions.
- **Out of scope:** SSO, OAuth, MFA, password reset flows — not needed for a 5-day hackathon demo.

---

## 12. Folder Structure

```
chainvision/
├── 00_PROJECT_CONTEXT.md
├── docker-compose.yml
├── .env.example
│
├── frontend/                       # React + Vite + TS
│   ├── src/
│   │   ├── pages/
│   │   │   ├── planner/            # P1 dashboard views
│   │   │   └── procurement/        # PR2 dashboard views
│   │   ├── components/
│   │   ├── hooks/                  # useSocket, useAuth, etc.
│   │   ├── api/                    # axios clients
│   │   └── App.tsx
│   └── package.json
│
├── p1-backend/                     # Node + Express + TS (Demand & Replenishment)
│   ├── src/
│   │   ├── engine/                 # deterministic calc: demand, safetyStock, eoq, rop, fefo, expiryRisk
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── recommendationService.ts
│   │   │   ├── aiRationaleService.ts   # Gemini API calls, rationale only
│   │   │   └── pr2ClientService.ts     # POST to PR2 on new recommendation
│   │   ├── realtime/                # Socket.IO hub + internal emit endpoint
│   │   ├── db/                      # Prisma schema/client
│   │   └── auth/                    # JWT issue/verify
│   ├── prisma/schema.prisma
│   └── package.json
│
├── pr2-backend/                    # Java + Spring Boot (Procure-to-Pay)
│   ├── src/main/java/com/chainvision/pr2/
│   │   ├── requisition/
│   │   ├── sourcing/                # deterministic supplier scoring
│   │   ├── purchaseorder/
│   │   ├── goodsreceipt/
│   │   ├── invoice/
│   │   │   ├── OcrService.java      # calls Gemini API for document extraction
│   │   │   └── ThreeWayMatchService.java  # deterministic match logic
│   │   ├── payment/
│   │   ├── realtime/                # webhook client → P1 Node hub
│   │   ├── security/                # JWT verification
│   │   └── config/
│   ├── src/main/resources/application.yml
│   └── pom.xml
│
├── shared/
│   ├── contracts/                   # JSON schema / TypeScript+Java DTO definitions for the P1→PR2 handoff object
│   └── seed-data/                   # scripts + generated synthetic datasets (Section 15)
│
└── infra/
    ├── postgres/init.sql            # creates p1 and pr2 schemas
    └── docker/
```

---

## 13. API Structure

### 13.1 P1 Backend (Node, base path `/api`)
```
POST   /api/auth/login
POST   /api/auth/register

GET    /api/skus
GET    /api/distribution-centers
GET    /api/inventory                       # batch-level, filterable by sku/dc
POST   /api/demand-signals                  # ingest/simulate a demand signal
GET    /api/demand-signals

GET    /api/replenishment/recommendations   # list, filter by urgency/status
POST   /api/replenishment/recalculate       # trigger the deterministic engine run
GET    /api/replenishment/recommendations/:id

POST   /internal/realtime/emit              # called by PR2 to relay events (internal auth key, not user JWT)
```

### 13.2 PR2 Backend (Java/Spring Boot, base path `/api`)
```
POST   /api/requisitions/from-recommendation   # called by P1 on new recommendation
POST   /api/requisitions                       # manual / chatbot-derived creation
POST   /api/requisitions/parse-intent          # proxies to Gemini for NL intent extraction
GET    /api/requisitions

POST   /api/suppliers/select/{requisitionId}   # deterministic supplier scoring → returns chosen supplier
GET    /api/suppliers

POST   /api/purchase-orders/{requisitionId}
GET    /api/purchase-orders
GET    /api/purchase-orders/{id}

POST   /api/goods-receipts                     # simulate receipt against a PO
GET    /api/goods-receipts

POST   /api/invoices/upload                    # multipart file → triggers OCR extraction
GET    /api/invoices
GET    /api/invoices/{id}

POST   /api/invoices/{id}/match                # runs deterministic 3-way match
GET    /api/exceptions                         # invoices/matches in EXCEPTION/MISMATCHED state
POST   /api/exceptions/{id}/resolve            # manual approve/reject

GET    /api/analytics/p2p-summary              # touchless %, cycle time, exception rate
```

---

## 14. Environment Variables

**Root `.env` (docker-compose level) / `.env.example`:**
```
# Postgres
POSTGRES_USER=chainvision
POSTGRES_PASSWORD=chainvision_dev
POSTGRES_DB=chainvision
POSTGRES_PORT=5432

# P1 backend (Node)
P1_PORT=4000
DATABASE_URL_P1=postgresql://chainvision:chainvision_dev@postgres:5432/chainvision?schema=p1
JWT_SECRET=replace_with_shared_secret
GEMINI_API_KEY=AIzaSy-xxxxx
GEMINI_MODEL=gemini-2.0-flash
PR2_BASE_URL=http://pr2-backend:8080
INTERNAL_REALTIME_KEY=replace_with_internal_key

# PR2 backend (Java/Spring Boot)
PR2_PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/chainvision?currentSchema=pr2
SPRING_DATASOURCE_USERNAME=chainvision
SPRING_DATASOURCE_PASSWORD=chainvision_dev
JWT_SECRET=replace_with_shared_secret   # must match P1's value
GEMINI_API_KEY=AIzaSy-xxxxx             # for OCR + intent extraction calls made from Java side, if applicable
GEMINI_MODEL=gemini-2.0-flash
P1_REALTIME_URL=http://p1-backend:4000/internal/realtime/emit
INTERNAL_REALTIME_KEY=replace_with_internal_key  # must match P1's value

# Frontend
VITE_P1_API_BASE=http://localhost:4000/api
VITE_PR2_API_BASE=http://localhost:8080/api
VITE_SOCKET_URL=http://localhost:4000
```

**Note:** `GEMINI_API_KEY` should never be hardcoded or committed; both backends read it from environment only. Get a free key from Google AI Studio (https://aistudio.google.com/apikey) — no billing account required for the free tier, but be aware of and design around the free tier's requests-per-minute / requests-per-day limits (batch or throttle calls during the demo if needed, and keep a cached/fallback rationale string ready in case of rate-limit errors during live judging).

---

## 15. Seed-Data Requirements

All data is **synthetic**, generated with realistic boundary conditions (per hackathon brief guidance). Suggested approach: write a one-off seed script (Node or SQL) per schema, plus optionally use GenAI (Gemini, or any free chat tool) offline to help author realistic-looking CSVs (not at runtime).

### 15.1 P1 seed data
- **~15–20 SKUs** across 2–3 categories (e.g., antibiotics, analgesics, cold/flu) with realistic unit costs and lead times (7–21 days).
- **4–6 Distribution Centers**, at least 2 explicitly tagged Tier-1 (metro) and 2 Tier-2, with differing capacities.
- **Inventory batches**: multiple batches per SKU/DC with a spread of expiry dates — include some **near-expiry** and some **already-breached-threshold** batches to make FEFO and expiry-risk demo-able immediately.
- **Demand signals**: 90 days of historical daily/weekly demand per SKU/DC, plus a seasonal spike scenario (+60%) affecting Tier-2 city cold/flu SKUs specifically, to reproduce the exact hackathon narrative.
- Include at least **3–5 SKUs deliberately below reorder point** at seed time so the dashboard shows live alerts on first load without waiting for a simulation tick.

### 15.2 PR2 seed data
- **6–10 suppliers** with varied price index, lead time, OTD score, quality score, and capacity — deliberately include one "cheap but unreliable" and one "expensive but high-performing" supplier to make the deterministic scoring visibly meaningful.
- **2–3 sample invoice files** (PDF or image) pre-generated: one clean/matching, one with a quantity mismatch, one with a price mismatch — used to demo both the auto-approve and exception paths live.
- A handful of pre-existing POs and GRNs in different states (ISSUED, RECEIVED, CLOSED) so the dashboard isn't empty on first load.

### 15.3 Shared
- One seed script/documented order: `1) create schemas → 2) seed p1 → 3) seed pr2 → 4) create demo users (planner@demo.com / procurement@demo.com / admin@demo.com, password: demo1234)`.

---

## 16. Demo Flow (End-to-End Script for Judges)

1. **Login** as Planner → show Planner Dashboard: current inventory, expiry-risk heatmap, active low-stock alerts (pre-seeded so it's visible instantly).
2. Trigger (or show already-triggered) a **demand spike simulation** for a Tier-2 city SKU → dashboard updates in realtime, deterministic engine computes new ROP/EOQ, a new **Replenishment Recommendation** appears with AI-generated rationale text.
3. Recommendation is automatically sent to PR2 → switch to **Procurement Dashboard**, show the new **system-generated Purchase Requisition** appear in realtime (Socket.IO push).
4. Optionally, also demo the **chatbot/manual path**: type a free-text request into the requisition chatbot, show Gemini's structured intent extraction pre-filling the form.
5. Show deterministic **supplier selection** → PO auto-created, showing why that supplier was chosen (price/lead time/OTD/quality breakdown, not AI-decided).
6. **Simulate goods receipt** against the PO (one click).
7. **Upload an invoice** (use the pre-seeded matching sample) → show Gemini-based OCR extraction of fields.
8. Run **3-way match** → shows MATCHED → **payment auto-approved**, all live on the P2P analytics dashboard (touchless % ticks up).
9. Upload the **mismatched sample invoice** → show 3-way match failing deterministically, landing in the **Exception Queue** with an AI-generated plain-English explanation, then a human "Procurement Officer" manually resolving it.
10. Close on the **P2P analytics dashboard**: touchless-processing rate, cycle time, and a summary tying back to the original demand signal — full loop shown.

---

## 17. Definition of Done

A feature/module is "done" for hackathon purposes only when **all** of the following are true:

- [ ] Deterministic calculations (demand, safety stock, EOQ, ROP, FEFO, expiry risk, supplier scoring, 3-way match) are implemented as pure functions/services with **no AI call in the code path**, and can be shown to produce the same output for the same input (no LLM non-determinism in these areas).
- [ ] The P1 → PR2 handoff works end-to-end: a recommendation created in P1 visibly becomes a requisition in PR2 without manual intervention.
- [ ] Both dashboards reflect state changes in **realtime** (Socket.IO) or, at minimum, via documented polling fallback.
- [ ] AI API is used **only** for: (a) NL requisition intent extraction, (b) rationale/explanation text generation, and (c) invoice OCR/document extraction — verified by code review that no AI output feeds directly into a quantity/threshold/decision field.
- [ ] Authentication works for all three roles; role-gated routes are enforced (not just hidden in UI).
- [ ] Seed data loads cleanly via one documented command/script and produces a non-empty, demo-ready dashboard on first run.
- [ ] The full 10-step demo flow (Section 16) can be run live without manual DB edits.
- [ ] `docker-compose up` brings up all four containers (frontend, p1-backend, pr2-backend, postgres) successfully on a clean machine.
- [ ] A short README (separate from this file) documents how to run the project locally.
- [ ] No secrets committed to source control; `.env.example` is complete and accurate.

---

## 18. 5-Day Priorities

Aligned to the hackathon's own timeline structure (Ideate/Design/Build phase, then Evaluation) — treat this as the internal team plan within that window.

**Day 1 — Foundation**
- Finalize this context doc + confirm schema/contracts (Section 4, 7) with both sub-teams.
- Scaffold all four repos/containers; get `docker-compose up` running empty end-to-end (frontend ↔ p1-backend ↔ pr2-backend ↔ postgres) with a health-check route each.
- Set up Postgres schemas (`p1`, `pr2`) and shared JWT secret.
- Write seed-data scripts (structure only, data can be placeholder).

**Day 2 — P1 Core**
- Implement deterministic engine: demand calc, safety stock, ROP, EOQ, FEFO, expiry risk (unit-tested).
- Implement inventory/SKU/DC CRUD + demand signal ingestion endpoints.
- Generate realistic seed data (Section 15.1) including the seasonal spike scenario.
- Basic Planner dashboard UI wired to real data (no AI/realtime yet).

**Day 3 — PR2 Core**
- Implement requisition, deterministic supplier scoring, PO, GRN entities and endpoints (Spring Boot).
- Implement the P1 → PR2 handoff endpoint and confirm live integration between the two backends.
- Generate PR2 seed data (Section 15.2) including sample invoices.
- Basic Procurement dashboard UI wired to real data.

**Day 4 — AI, OCR, Realtime, 3-Way Match**
- Wire Gemini API: rationale generation (P1 side), intent extraction (PR2 chatbot), invoice document extraction (OCR).
- Implement deterministic 3-way match + exception queue + payment approval logic.
- Wire Socket.IO hub in P1 + webhook relay from PR2; confirm realtime updates across both dashboards.
- Auth end-to-end (login, role gating) on both frontends.

**Day 5 — Polish, Demo Rehearsal, Buffer**
- Run the full 10-step demo flow (Section 16) start to finish multiple times; fix integration gaps.
- Polish dashboards (charts, heatmap, exception queue UX) — this is where "UI/UX" and "Presentation" evaluation criteria are earned.
- Write the README and prep the presentation deck/video (per hackathon submission requirement: PPT or video over email).
- Buffer time for whatever broke on Day 4 (realtime + cross-service integration is historically the riskiest part — protect time for it).

---

*End of 00_PROJECT_CONTEXT.md. No application code, and no PROMPTS.md, has been created per instructions — this document is the standalone reference for all subsequent work.*
