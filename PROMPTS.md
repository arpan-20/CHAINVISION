# PROMPTS.md
## CHAINVISION — Multi-Agent Build Plan (45 Prompts / 28 Phases)

**Purpose:** This file is the execution backlog for building CHAINVISION with ~15 parallel Claude sessions over 5 days. Every prompt below is small, independently executable, and scoped to a narrow set of files to avoid merge conflicts. Assign one prompt to one Claude session at a time; do not assign two active [PARALLEL] prompts that touch the same file.

**Source of truth:** `00_PROJECT_CONTEXT.md` (in the repo root). Every prompt assumes the assigned Claude session has read it in full before writing anything.

---

## ARCHITECTURE NOTE — Supabase Adoption (supersedes parts of 00_PROJECT_CONTEXT.md)

To fit a 15-person, 5-day build, we are using **Supabase** (managed Postgres + built-in Auth + built-in Realtime) instead of the raw self-hosted Postgres + custom JWT + custom Socket.IO hub described in Sections 5–8, 11, 14 of `00_PROJECT_CONTEXT.md`. This removes three categories of custom infrastructure work (auth server, realtime hub, DB hosting) that would otherwise consume scarce build time.

**What stays the same as 00_PROJECT_CONTEXT.md:** all deterministic business logic (Sections 5.1, 2, 3, 4), the P1 (Node/Express) + PR2 (Java/Spring Boot) service split, the database schema/tables (Section 7), the REST API structure (Section 13), the Gemini AI scope (Section 9), the OCR approach (Section 10, refined below), and the overall folder structure (Section 12).

**What changes:**
- **Database:** Tables from Section 7 are created directly in a **Supabase Postgres project** (one project, two schemas: `p1` and `pr2`) instead of a self-hosted Postgres container. Both backends connect via the Supabase Postgres connection string (standard JDBC/`pg` driver — no Supabase-specific SDK required for reads/writes from the backends).
- **Auth:** Replaces the custom JWT/bcrypt service in Section 11 with **Supabase Auth** (email+password). Supabase issues the JWT; both backends verify it using Supabase's JWKS/public key instead of a shared custom secret.
- **Realtime:** Replaces the custom Socket.IO hub + webhook-relay pattern in Section 8 with **Supabase Realtime** (Postgres change-data-capture subscriptions). Both frontends subscribe directly to table changes (`replenishment_recommendations`, `purchase_requisitions`, `purchase_orders`, `invoices`, `payment_approvals`, etc.) via `supabase-js` — no custom hub or webhook relay service is needed.
- **OCR ordering:** Section 10 listed Gemini vision as primary and Tesseract.js as fallback. For this build we reverse the priority order: **Tesseract.js is implemented first as the primary OCR text-extraction step** (fast, free, no rate limits — critical with 15 teams building/demoing concurrently), and **Gemini is used downstream to turn the raw OCR text into structured JSON fields** (Gemini is good at structuring messy text, less critical to run at OCR-pixel level). This still satisfies the hard rule that AI never performs the 3-way match decision itself.

All other content in `00_PROJECT_CONTEXT.md` — deterministic formulas, schema fields, demo flow, Definition of Done — remains authoritative. Where a prompt below references "Section X" it means Section X of `00_PROJECT_CONTEXT.md`.

---

## Global Rules (apply to every prompt below)

1. Every coding prompt begins execution with: **"Read 00_PROJECT_CONTEXT.md before starting."** — do not skip this even if the task looks self-contained.
2. Stay strictly inside the files listed under `CREATE:` and `MODIFY:`. Never edit a file listed under `READ ONLY:`.
3. Never touch another prompt's owned files, even if it seems convenient. If you discover a real blocker in another prompt's territory, stop and report it in your Completion Report instead of fixing it yourself.
4. Deterministic business logic (demand, safety stock, ROP, EOQ, FEFO, expiry risk, supplier scoring, 3-way match) must never call an AI API. AI (Gemini) is only used where a prompt explicitly says so (intent extraction, rationale text, OCR-text-to-JSON structuring, mismatch explanation).
5. No secrets committed to source control. Use `.env` / `.env.example` patterns as defined in Section 14 (adapted for Supabase — see Phase 2/23 prompts for the updated variable names).
6. Every prompt ends with a **Completion Report** — a short structured message the session posts back so the human coordinator can track progress without reading every diff.
7. [PARALLEL] prompts may run at the same time as other [PARALLEL] prompts, provided their dependencies are met and their file sets don't overlap. [SEQUENTIAL] prompts must run after their listed dependencies finish and generally block other work in the same phase.

---

## Phase Overview

| Phase | Name | Prompts |
|---|---|---|
| 1 | Repository and project setup | P1.1–P1.4 |
| 2 | Supabase setup and database schema | P2.1 |
| 3 | Seed data | P3.1–P3.2 |
| 4 | Backend foundation | P4.1–P4.2 |
| 5 | P1 demand sensing | P5.1 |
| 6 | P1 inventory and expiry | P6.1 |
| 7 | P1 FEFO and replenishment | P7.1–P7.2 |
| 8 | P1 APIs | P8.1 |
| 9 | P1 frontend | P9.1–P9.2 |
| 10 | PR2 supplier selection | P10.1 |
| 11 | PR2 requisitions | P11.1 |
| 12 | Gemini NLP | P12.1 |
| 13 | Purchase orders | P13.1 |
| 14 | Goods receipt | P14.1 |
| 15 | Tesseract.js OCR | P15.1 |
| 16 | Invoice processing | P16.1 |
| 17 | 3-way matching | P17.1 |
| 18 | Payment approval | P18.1 |
| 19 | PR2 frontend | P19.1–P19.3 |
| 20 | P1 → PR2 handoff | P20.1 |
| 21 | Supabase Realtime | P21.1 |
| 22 | Gemini rationale | P22.1 |
| 23 | Supabase Auth | P23.1–P23.3 |
| 24 | Error handling and fallbacks | P24.1–P24.3 |
| 25 | Testing | P25.1–P25.3 |
| 26 | Integration | P26.1 |
| 27 | Deployment | P27.1–P27.2 |
| 28 | Final demo preparation | P28.1–P28.2 |

**Total: 45 prompts.**

---

# PHASE 1 — Repository and Project Setup

### P1.1 — Root Repository Scaffold
**Phase:** 1 — Repository and project setup
**Type:** [SEQUENTIAL] (blocks all other work)
**Dependencies:** None

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Create the root monorepo skeleton so all 15 sessions have a shared, agreed-upon folder structure to build into (Section 12), adapted for Supabase per the Architecture Note above.

**CREATE:**
- `/README.md` (placeholder, one paragraph + "see 00_PROJECT_CONTEXT.md")
- `/.gitignore` (node_modules, target/, .env, dist/, build/)
- `/.env.example` (root-level, Supabase connection vars — see Phase 2/4 for exact keys, placeholder values only)
- `/docker-compose.yml` (skeleton: `frontend`, `p1-backend`, `pr2-backend` services; no `postgres` container since DB is Supabase-hosted — leave build contexts pointing at empty folders for now)
- `/frontend/.gitkeep`
- `/p1-backend/.gitkeep`
- `/pr2-backend/.gitkeep`
- `/shared/contracts/.gitkeep`
- `/shared/seed-data/.gitkeep`
- `/infra/.gitkeep`

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`

**Implementation Instructions:**
1. Create the exact folder tree from Section 12 of the context doc, minus the `infra/postgres/init.sql` piece (not needed — Supabase hosts Postgres).
2. `docker-compose.yml` should define three services (`frontend`, `p1-backend`, `pr2-backend`) with `build: ./<folder>`, exposed ports 5173/4000/8080, and `env_file: .env`. Leave `image`/`build` context pointing at folders that will be filled in by P1.2–P1.4.
3. `.env.example` should include commented placeholders for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` — do not fill in real values.
4. Do not write any application code.

**Constraints:**
- No real secrets anywhere in the repo.
- Do not create `frontend/package.json`, `p1-backend/package.json`, or `pr2-backend/pom.xml` — those belong to P1.2/P1.3/P1.4.

**Acceptance Criteria:**
- [ ] Folder tree matches Section 12 (adapted per Architecture Note).
- [ ] `docker-compose.yml` is valid YAML (`docker compose config` doesn't error).
- [ ] No secrets committed.

**Testing Requirements:** Run `docker compose config` to confirm the YAML parses without error.

**Completion Report:** State the final folder tree created, confirm `.gitignore` and `.env.example` contents, and flag that P1.2–P1.4 can now start in parallel.

---

### P1.2 — Frontend Scaffold (React + Vite + TS + Tailwind)
**Phase:** 1 — Repository and project setup
**Type:** [PARALLEL]
**Dependencies:** P1.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Scaffold the frontend app per Section 5.2/12 so later phases (9, 19) can build screens into it.

**CREATE:**
- `/frontend/package.json`, `/frontend/vite.config.ts`, `/frontend/tsconfig.json`, `/frontend/tailwind.config.js`, `/frontend/postcss.config.js`
- `/frontend/index.html`
- `/frontend/src/main.tsx`, `/frontend/src/App.tsx`
- `/frontend/src/pages/planner/.gitkeep`, `/frontend/src/pages/procurement/.gitkeep`
- `/frontend/src/components/.gitkeep`
- `/frontend/src/hooks/.gitkeep`
- `/frontend/src/api/.gitkeep`
- `/frontend/Dockerfile`

**MODIFY:** `/docker-compose.yml` (fill in the `frontend` service build/port details only)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, everything under `/p1-backend`, `/pr2-backend`

**Implementation Instructions:**
1. Scaffold a standard Vite + React + TypeScript project. Add Tailwind CSS (config + directives in a root `index.css`, imported in `main.tsx`).
2. Add `axios`, `recharts`, `socket.io-client` is **not** needed (Supabase Realtime replaces it) — instead add `@supabase/supabase-js`.
3. `App.tsx` should render a placeholder route stub only ("CHAINVISION — under construction") — no real pages yet.
4. Add a minimal multi-stage `Dockerfile` (node build → static serve, or vite dev server for hackathon simplicity — dev server is fine given the timeline).
5. Update only the `frontend` block in `/docker-compose.yml`.

**Constraints:** Do not add routing library decisions that block later phases — use `react-router-dom` (standard, low-risk choice) and note it in the completion report so Phase 9/19 know it's available.

**Acceptance Criteria:**
- [ ] `npm install && npm run dev` starts a working dev server showing the placeholder page.
- [ ] Tailwind classes render correctly on the placeholder page.
- [ ] `docker-compose.yml`'s frontend service builds successfully.

**Testing Requirements:** Manually run `npm run dev` and confirm the placeholder loads in a browser at the expected port.

**Completion Report:** Confirm dev server runs, list installed dependencies, note the routing library chosen.

---

### P1.3 — P1 Node Backend Scaffold
**Phase:** 1 — Repository and project setup
**Type:** [PARALLEL]
**Dependencies:** P1.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Scaffold the P1 backend (Node/Express/TypeScript) skeleton per Section 5.3/12.

**CREATE:**
- `/p1-backend/package.json`, `/p1-backend/tsconfig.json`
- `/p1-backend/src/index.ts` (Express app bootstrap, listens on `P1_PORT`)
- `/p1-backend/src/engine/.gitkeep`
- `/p1-backend/src/routes/.gitkeep`
- `/p1-backend/src/services/.gitkeep`
- `/p1-backend/src/realtime/.gitkeep`
- `/p1-backend/src/db/.gitkeep`
- `/p1-backend/src/auth/.gitkeep`
- `/p1-backend/Dockerfile`

**MODIFY:** `/docker-compose.yml` (fill in `p1-backend` service only)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend`, `/pr2-backend`

**Implementation Instructions:**
1. Scaffold Express + TypeScript with `ts-node-dev` for local dev.
2. `src/index.ts` should only expose `GET /health` returning `{ status: "ok" }` — no business routes yet, those come in later phases.
3. Add dependencies that later phases will need so nobody re-scaffolds package.json: `express`, `cors`, `dotenv`, `@supabase/supabase-js`, `zod` (for request validation).
4. Add a Dockerfile (multi-stage: build TS → run compiled JS, or `ts-node-dev` directly for hackathon speed).
5. Update only the `p1-backend` block in `/docker-compose.yml`.

**Constraints:** Do not add Prisma — per the Architecture Note, DB access goes through `@supabase/supabase-js` (or plain `pg` if a prompt later needs raw SQL); do not introduce an ORM that competes with that decision without flagging it in the completion report.

**Acceptance Criteria:**
- [ ] `npm install && npm run dev` starts the server and `GET /health` returns 200.
- [ ] Dockerfile builds successfully.

**Testing Requirements:** `curl http://localhost:4000/health` returns `{ "status": "ok" }`.

**Completion Report:** Confirm health check works, list installed dependencies, confirm DB access library decision (`@supabase/supabase-js`).

---

### P1.4 — PR2 Java Backend Scaffold
**Phase:** 1 — Repository and project setup
**Type:** [PARALLEL]
**Dependencies:** P1.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Scaffold the PR2 backend (Java 17 + Spring Boot + Maven) skeleton per Section 5.3/12. This is mandated to be Java per the team's stated skill constraint.

**CREATE:**
- `/pr2-backend/pom.xml`
- `/pr2-backend/src/main/java/com/chainvision/pr2/Pr2Application.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/sourcing/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/goodsreceipt/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/payment/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/realtime/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/security/.gitkeep`
- `/pr2-backend/src/main/java/com/chainvision/pr2/config/.gitkeep`
- `/pr2-backend/src/main/resources/application.yml`
- `/pr2-backend/Dockerfile`

**MODIFY:** `/docker-compose.yml` (fill in `pr2-backend` service only)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend`, `/p1-backend`

**Implementation Instructions:**
1. Scaffold a standard Spring Boot 3.x app (`spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `postgresql` driver, `spring-boot-starter-security` for later JWT verification, `spring-boot-starter-validation`).
2. Add a single `GET /health` controller returning `{ "status": "ok" }` — no business logic yet.
3. `application.yml` should read datasource config from environment variables (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` — these will point at the Supabase Postgres connection string, filled in by Phase 2/4).
4. Add a Dockerfile (multi-stage Maven build).
5. Update only the `pr2-backend` block in `/docker-compose.yml`.

**Constraints:** Use package `com.chainvision.pr2` consistently. Do not add Spring Security *rules* yet (that's Phase 23) — just the dependency.

**Acceptance Criteria:**
- [ ] `mvn spring-boot:run` starts the app and `GET /health` returns 200.
- [ ] Dockerfile builds successfully.

**Testing Requirements:** `curl http://localhost:8080/health` returns `{ "status": "ok" }`.

**Completion Report:** Confirm health check works, list key Maven dependencies added, confirm package structure.

---

# PHASE 2 — Supabase Setup and Database Schema

### P2.1 — Supabase Project + Full Schema Migration
**Phase:** 2 — Supabase setup and database schema
**Type:** [SEQUENTIAL] (blocks Phases 3, 4, and all data-touching work)
**Dependencies:** P1.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Stand up the Supabase project and create every table from Section 7 (both `p1` and `pr2` schemas, plus the shared `users` table) as versioned SQL migrations, so every later backend prompt has a stable schema to code against.

**CREATE:**
- `/infra/supabase/migrations/0001_create_schemas.sql`
- `/infra/supabase/migrations/0002_p1_tables.sql` (skus, distribution_centers, inventory_batches, demand_signals, replenishment_recommendations — exact columns per Section 7.1)
- `/infra/supabase/migrations/0003_pr2_tables.sql` (suppliers, purchase_requisitions, purchase_orders, goods_receipts, invoices, three_way_matches, payment_approvals — exact columns per Section 7.2)
- `/infra/supabase/migrations/0004_shared_users_and_rls.sql` (users table with role enum; basic Row Level Security policies: authenticated users can read; writes go through backend service-role key only)
- `/infra/supabase/README.md` (how to apply migrations via Supabase CLI or SQL editor, and how to get project URL/keys)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`

**Implementation Instructions:**
1. Create a Supabase project (or document exact manual steps if the session doesn't have direct account access — in that case, produce the SQL and clear step-by-step instructions for a human to run them in the Supabase SQL editor).
2. Translate every table and column from Section 7.1 and 7.2 verbatim, using Postgres types (`uuid` PK with `gen_random_uuid()` default, `numeric`, `int`, `date`, `timestamp`, `text`, and Postgres `enum` types for the status/urgency/role fields listed in Section 7).
3. Add foreign keys within each schema as described (e.g., `inventory_batches.sku_id → skus.id`). Cross-schema references (e.g., `purchase_requisitions.recommendation_id`) stay as plain text/uuid columns without a hard FK, exactly as specified in Section 7.2.
4. `users` table: `id uuid PK` (matches Supabase Auth `auth.users.id`), `email text unique`, `role enum(PLANNER, PROCUREMENT_OFFICER, ADMIN)`.
5. Enable Row Level Security on all tables; add a simple "authenticated read" policy and note that writes should go through each backend's Supabase **service role key** (bypasses RLS) rather than end-user tokens, since the backends own all writes.
6. Enable Supabase Realtime replication on: `p1.replenishment_recommendations`, `p1.inventory_batches`, `pr2.purchase_requisitions`, `pr2.purchase_orders`, `pr2.invoices`, `pr2.payment_approvals` (needed by Phase 21).

**Constraints:**
- Column names and types must match Section 7 exactly — later prompts (5–18) are written against those names.
- Do not create any seed data here — that's Phase 3.

**Acceptance Criteria:**
- [ ] All tables from Section 7.1 and 7.2 exist with correct columns/types/enums.
- [ ] `users` table exists with role enum.
- [ ] RLS is enabled with at least a read policy on every table.
- [ ] Realtime replication enabled on the six tables listed above.
- [ ] Migrations are numbered and re-runnable in order on a clean project.

**Testing Requirements:** Run each migration file against a clean Supabase project in order; confirm no errors; run `\dt p1.*` and `\dt pr2.*` (or Supabase Table Editor) to visually confirm all tables exist.

**Completion Report:** List every table created per schema, confirm RLS + Realtime are enabled, and provide the `SUPABASE_URL` / key **names** (not values) that all later backend prompts will need to reference in their own `.env`.

---

# PHASE 3 — Seed Data

### P3.1 — P1 Seed Data Script
**Phase:** 3 — Seed data
**Type:** [PARALLEL]
**Dependencies:** P2.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Populate the `p1` schema with realistic synthetic data per Section 15.1, so the Planner dashboard is demo-ready from first load.

**CREATE:**
- `/shared/seed-data/p1_seed.ts` (Node script using `@supabase/supabase-js` with the service role key)
- `/shared/seed-data/p1_seed_data.json` (the actual generated dataset, checked in for reproducibility)
- `/shared/seed-data/README_p1.md`

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/infra/supabase/migrations/*`

**Implementation Instructions:**
1. Generate 15–20 SKUs across 2–3 categories (antibiotics, analgesics, cold/flu) with realistic unit costs (₹ or $, be consistent) and lead times 7–21 days.
2. Generate 4–6 DCs, at least 2 Tier-1 (metro) and 2 Tier-2, with differing capacities.
3. Generate inventory batches per SKU/DC with a spread of expiry dates, deliberately including some near-expiry and some already-critical batches.
4. Generate 90 days of historical demand per SKU/DC plus a seasonal +60% spike scenario for Tier-2 cold/flu SKUs, reproducing the exact hackathon narrative from Section 2.
5. Ensure at least 3–5 SKU/DC combos are seeded already below reorder-point-equivalent stock levels (exact ROP itself is computed later by Phase 7's engine, but seed the raw stock/demand numbers so that once Phase 7 runs, those combos will surface as alerts).
6. Script should be idempotent-ish for hackathon purposes (safe to note "run once"; a `--reset` flag that truncates and re-seeds is a nice-to-have, not required).

**Constraints:** Only write to `p1` schema tables. Do not seed `pr2` tables (that's P3.2) or the `users` table (that's P23).

**Acceptance Criteria:**
- [ ] Running the script populates all 5 `p1` tables with data matching the counts above.
- [ ] At least 3 SKU/DC combos are seeded with stock low enough to be flagged once Phase 7's ROP logic runs.
- [ ] At least 2 batches per some SKUs have near-expiry dates (within 30 days) to demo expiry risk.

**Testing Requirements:** Run the script against the Supabase project from P2.1; query row counts per table and confirm they match expectations; spot-check 2–3 rows manually for realism.

**Completion Report:** Report row counts per table, list the 3–5 deliberately-low-stock SKU/DC combos by name (for later demo reference), confirm script location and how to re-run it.

---

### P3.2 — PR2 Seed Data Script
**Phase:** 3 — Seed data
**Type:** [PARALLEL]
**Dependencies:** P2.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Populate the `pr2` schema with realistic synthetic data per Section 15.2, including sample invoice files, so the Procurement dashboard and the 3-way-match demo path work from day one.

**CREATE:**
- `/shared/seed-data/pr2_seed.ts` (Node script using `@supabase/supabase-js` service role key)
- `/shared/seed-data/pr2_seed_data.json`
- `/shared/seed-data/sample_invoices/invoice_matching.pdf` (or `.png`)
- `/shared/seed-data/sample_invoices/invoice_qty_mismatch.pdf`
- `/shared/seed-data/sample_invoices/invoice_price_mismatch.pdf`
- `/shared/seed-data/README_pr2.md`

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/infra/supabase/migrations/*`, `/shared/seed-data/p1_seed_data.json` (read-only reference so SKU names/codes line up between P1 and PR2 data — do not modify it)

**Implementation Instructions:**
1. Generate 6–10 suppliers with varied price index, lead time, OTD score, quality score, and capacity — deliberately include one "cheap but unreliable" and one "expensive but high-performing" supplier (Section 15.2).
2. Reuse SKU codes/names from `p1_seed_data.json` so downstream matching (SKU-to-supplier, invoice line items) references real, consistent SKUs across both schemas.
3. Create a handful of pre-existing POs and GRNs in different states (ISSUED, RECEIVED, CLOSED) so the dashboard isn't empty on first load.
4. Generate 3 simple sample invoice documents (can be plain generated PDFs/images with clearly printed fields — doesn't need to be visually fancy): one that will cleanly match an existing PO+GRN, one with a deliberate quantity mismatch, one with a deliberate price mismatch. These will be uploaded live during the Phase 16/17 demo.
5. Insert corresponding `purchase_orders`/`goods_receipts` rows that the "matching" invoice is designed to match against, and rows that the two mismatch invoices are designed to fail against.

**Constraints:** Only write to `pr2` schema tables. Do not modify `p1_seed_data.json`, only read from it.

**Acceptance Criteria:**
- [ ] 6–10 suppliers seeded with the described score spread.
- [ ] At least 2 POs in different statuses seeded, with matching GRNs.
- [ ] 3 sample invoice files exist and are referenced in the README with which PO/GRN each is meant to test.

**Testing Requirements:** Run the script; confirm row counts; manually open each sample invoice file to confirm the fields are legible/parseable for OCR later.

**Completion Report:** List supplier count and score spread, list the PO/GRN pairs seeded for each of the 3 sample invoices, confirm file paths.

---

# PHASE 4 — Backend Foundation

### P4.1 — P1 Backend Foundation (Config, Supabase Client, Contracts)
**Phase:** 4 — Backend foundation
**Type:** [SEQUENTIAL] (blocks Phases 5–8)
**Dependencies:** P1.3, P2.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Wire the P1 backend to Supabase, set up shared config/middleware, and publish the P1→PR2 handoff contract that PR2 will consume.

**CREATE:**
- `/p1-backend/src/config/env.ts` (typed env var loader/validator)
- `/p1-backend/src/db/supabaseClient.ts` (initializes `@supabase/supabase-js` client using service role key)
- `/p1-backend/src/middleware/errorHandler.ts` (basic error-handling middleware, expanded later in Phase 24)
- `/shared/contracts/replenishmentRecommendation.schema.json` (JSON Schema for the handoff object from Section 4)
- `/shared/contracts/README.md` (explains the contract, how P1 emits it, how PR2 consumes it)

**MODIFY:**
- `/p1-backend/src/index.ts` (wire in env loader, Supabase client init, error handler middleware — health check stays)
- `/.env.example` (add real variable names: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `P1_PORT`, `PR2_BASE_URL`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/infra/supabase/migrations/*`, `/pr2-backend/**`

**Implementation Instructions:**
1. `env.ts` validates presence of `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `P1_PORT`, `PR2_BASE_URL` at startup and throws a clear error if missing.
2. `supabaseClient.ts` exports a single configured client instance for reuse across services.
3. `errorHandler.ts`: a basic Express error middleware that catches thrown errors and returns `{ error: message }` with a proper status code — full hardening happens in Phase 24, this is just the skeleton so later routes have something to throw into.
4. Write the JSON Schema for the `ReplenishmentRecommendation` object exactly as specified in Section 4 (recommendationId, skuId, skuName, dcId, recommendedQty, urgency enum, reason, aiRationale, expiryRiskContext, generatedAt).

**Constraints:** Do not implement any business routes yet — this prompt is infrastructure only.

**Acceptance Criteria:**
- [ ] Server still starts and `/health` still returns 200 with the new middleware/config wired in.
- [ ] Missing env vars cause a clear startup failure (test by temporarily unsetting one).
- [ ] `replenishmentRecommendation.schema.json` validates a sample object matching Section 4's example.

**Testing Requirements:** Start the server with valid env vars (confirm 200 on `/health`); start it with a missing var (confirm clear failure, not a silent crash).

**Completion Report:** Confirm server boots cleanly, confirm schema file location, flag to the PR2 team that the contract file exists at `/shared/contracts/replenishmentRecommendation.schema.json` for P4.2 to mirror as a Java DTO.

---

### P4.2 — PR2 Backend Foundation (Config, Datasource, DTO Mirror)
**Phase:** 4 — Backend foundation
**Type:** [SEQUENTIAL] (blocks Phases 10–18)
**Dependencies:** P1.4, P2.1, P4.1 (needs the published contract file)

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Wire the PR2 backend to the Supabase Postgres datasource, set up shared config/exception handling, and create the Java DTO mirroring P1's handoff contract.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/config/DatasourceConfig.java` (reads env-based datasource props, already scaffolded in `application.yml`)
- `/pr2-backend/src/main/java/com/chainvision/pr2/config/GlobalExceptionHandler.java` (skeleton `@ControllerAdvice`, expanded in Phase 24)
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/dto/ReplenishmentRecommendationDto.java` (mirrors `/shared/contracts/replenishmentRecommendation.schema.json` field-for-field)

**MODIFY:**
- `/pr2-backend/src/main/resources/application.yml` (finalize datasource + Supabase-related properties)
- `/.env.example` (add `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `PR2_PORT`, `P1_BASE_URL`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/shared/contracts/replenishmentRecommendation.schema.json`, `/infra/supabase/migrations/*`, `/p1-backend/**`

**Implementation Instructions:**
1. Point the Spring datasource at the Supabase Postgres connection string (`jdbc:postgresql://...` with `currentSchema=pr2` per Section 14, updated to use the Supabase host/credentials from P2.1).
2. `GlobalExceptionHandler` should catch generic exceptions and return a JSON error body — full hardening in Phase 24.
3. `ReplenishmentRecommendationDto.java` must have a field for every property in the JSON Schema, matching types (String, BigDecimal/Integer, enum for urgency, Instant/String for timestamp).
4. Confirm the app still boots and connects to the Supabase datasource successfully (a JPA `@Entity` isn't required yet — that comes with each domain phase 10–18).

**Constraints:** Do not implement any business routes yet — infrastructure only. Do not modify `/p1-backend/**`.

**Acceptance Criteria:**
- [ ] App boots and successfully connects to the Supabase Postgres datasource (verify via a simple `SELECT 1` on startup log or an actuator/health DB check).
- [ ] `ReplenishmentRecommendationDto` field names/types match the JSON Schema.
- [ ] `/health` still returns 200.

**Testing Requirements:** `mvn spring-boot:run` with real Supabase credentials in `.env`; confirm no datasource connection errors in logs; `curl /health`.

**Completion Report:** Confirm datasource connects successfully, confirm DTO field list matches the contract, flag readiness for Phases 10–18 to begin.

---

# PHASE 5 — P1 Demand Sensing

### P5.1 — Demand Calculation Engine + Ingestion Endpoints
**Phase:** 5 — P1 demand sensing
**Type:** [SEQUENTIAL] (blocks Phase 7)
**Dependencies:** P4.1, P3.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the deterministic demand-sensing calculation (historical demand + sensed seasonal adjustment) and the endpoints to ingest/list demand signals, per Section 2 and 5.1.

**CREATE:**
- `/p1-backend/src/engine/demandEngine.ts` (pure functions: `computeSensedDemand(historical, adjustmentPct)`, unit-testable, no I/O)
- `/p1-backend/src/services/demandService.ts` (reads/writes `demand_signals` via Supabase client)
- `/p1-backend/src/routes/demandRoutes.ts` (`POST /api/demand-signals`, `GET /api/demand-signals`)
- `/p1-backend/src/engine/demandEngine.test.ts`

**MODIFY:** `/p1-backend/src/index.ts` (mount `demandRoutes` under `/api`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/shared/contracts/**`, `/pr2-backend/**`

**Implementation Instructions:**
1. `demandEngine.ts`: pure, deterministic math only — no AI calls, no DB calls. Input: historical demand series + a sensed adjustment percentage (e.g., +60 for flu season) + source metadata. Output: an adjusted demand figure per SKU/DC usable by Phase 7's ROP/EOQ engine.
2. `demandService.ts` wraps Supabase reads/writes against the `p1.demand_signals` table (schema from Section 7.1).
3. Routes: `POST /api/demand-signals` accepts a new signal (used both for seed-adjacent data entry and for "simulate a demand spike" demo action); `GET /api/demand-signals?skuId=&dcId=` lists signals.
4. Validate request bodies with `zod`.

**Constraints:** No AI/Gemini calls anywhere in this prompt's files. Do not touch inventory/expiry tables (Phase 6) or replenishment tables (Phase 7).

**Acceptance Criteria:**
- [ ] `demandEngine.ts` functions are pure and covered by unit tests with at least 4 cases (flat demand, spike, decline, zero historical data edge case).
- [ ] `POST /api/demand-signals` persists a row correctly.
- [ ] `GET /api/demand-signals` returns seeded + newly created signals.

**Testing Requirements:** Run `demandEngine.test.ts` (use `vitest` or `jest`, whichever P1.3 set up); manually `curl` both endpoints against the seeded Supabase data.

**Completion Report:** Confirm test pass count, confirm both endpoints work against real seeded data, note the exact function signature of `computeSensedDemand` for Phase 7 to consume.

---

# PHASE 6 — P1 Inventory and Expiry

### P6.1 — Inventory Batch Service + Expiry Risk Engine
**Phase:** 6 — P1 inventory and expiry
**Type:** [SEQUENTIAL] (blocks Phase 7)
**Dependencies:** P4.1, P3.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement current-stock aggregation and the deterministic expiry-risk scoring engine per Section 2 and 5.1.

**CREATE:**
- `/p1-backend/src/engine/expiryRiskEngine.ts` (pure function: `scoreExpiryRisk(batches, today)` → risk level per batch, no I/O, no AI)
- `/p1-backend/src/services/inventoryService.ts` (reads `inventory_batches`, aggregates current stock per SKU/DC via Supabase client)
- `/p1-backend/src/routes/inventoryRoutes.ts` (`GET /api/inventory`, filterable by `skuId`/`dcId`)
- `/p1-backend/src/engine/expiryRiskEngine.test.ts`

**MODIFY:** `/p1-backend/src/index.ts` (mount `inventoryRoutes`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/engine/demandEngine.ts` (for reference/consistency of style only — do not modify)

**Implementation Instructions:**
1. `expiryRiskEngine.ts`: takes a list of batches (quantity, expiry_date, received_date) and today's date, returns a risk classification per batch (e.g., `CRITICAL` if expiry ≤ 30 days, `WARNING` if ≤ 90 days, `OK` otherwise — pick concrete thresholds and document them in code comments).
2. `inventoryService.ts`: aggregates `SUM(quantity)` per SKU/DC from `inventory_batches`, and separately exposes the raw batch list (needed by Phase 7's FEFO engine).
3. `GET /api/inventory` returns both the aggregated current-stock view and, optionally via a `?detail=batches` query param, the batch-level view with expiry risk scores attached.

**Constraints:** No AI calls. Deterministic thresholds must be documented as code comments referencing this prompt.

**Acceptance Criteria:**
- [ ] `expiryRiskEngine.ts` covered by unit tests including a batch expiring today, one far in the future, and one already expired.
- [ ] `GET /api/inventory` returns correct aggregated totals against seeded data.
- [ ] Batch-level detail view includes expiry risk classification per batch.

**Testing Requirements:** Run engine unit tests; `curl` the endpoint against seeded data and manually verify totals against `p1_seed_data.json`.

**Completion Report:** Confirm test results, document the exact risk thresholds chosen, confirm endpoint output shape for Phase 7/9 to consume.

---

# PHASE 7 — P1 FEFO and Replenishment

### P7.1 — FEFO Engine + Safety Stock / ROP / EOQ Engine
**Phase:** 7 — P1 FEFO and replenishment
**Type:** [SEQUENTIAL] (blocks P7.2, Phase 8)
**Dependencies:** P5.1, P6.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the remaining deterministic core calculations: FEFO sequencing and safety stock/reorder point/EOQ, per Section 2 and 5.1.

**CREATE:**
- `/p1-backend/src/engine/fefoEngine.ts` (pure function: `sequenceFefo(batches)` → batches ordered soonest-expiry-first, with suggested allocation order)
- `/p1-backend/src/engine/replenishmentMathEngine.ts` (pure functions: `computeSafetyStock(...)`, `computeReorderPoint(...)`, `computeEoq(...)` — standard formulas, e.g. safety stock = z-score × demand std dev × √lead time; ROP = (avg daily demand × lead time) + safety stock; EOQ = √((2 × annual demand × order cost) / holding cost) — document exact formula and any simplifying assumptions in code comments since this is a hackathon, not a full inventory-theory implementation)
- `/p1-backend/src/engine/fefoEngine.test.ts`
- `/p1-backend/src/engine/replenishmentMathEngine.test.ts`

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/engine/demandEngine.ts`, `/p1-backend/src/engine/expiryRiskEngine.ts`

**Implementation Instructions:**
1. `fefoEngine.ts`: given a batch list, sort by soonest expiry first; expose a helper that, given a quantity to allocate, returns which batches would be drawn down first (used later for demo narrative, not for actually mutating stock in this prompt).
2. `replenishmentMathEngine.ts`: implement the three formulas with clear, documented assumptions (pick a fixed service-level z-score like 1.65 for ~95%, a fixed order cost and holding cost constant if real supplier cost data isn't wired in yet — document these as `TODO`-free but clearly-labeled hackathon simplifications).
3. Both files must be pure, side-effect-free, and unit tested — no Supabase or Gemini calls.

**Constraints:** No AI calls, no DB calls in this prompt's files.

**Acceptance Criteria:**
- [ ] `fefoEngine.ts` correctly orders a mixed batch list soonest-expiry-first, tested with at least 3 cases.
- [ ] `replenishmentMathEngine.ts` functions produce sane, documented output for at least 3 demand/lead-time scenarios each.
- [ ] All formulas and constants are documented in code comments.

**Testing Requirements:** Run both test files; manually sanity-check one hand-calculated example against the code's output.

**Completion Report:** State the exact formulas and constants used (for later judge Q&A defensibility), confirm test results, confirm these are ready for P7.2 to orchestrate.

---

### P7.2 — Replenishment Recommendation Generator
**Phase:** 7 — P1 FEFO and replenishment
**Type:** [SEQUENTIAL]
**Dependencies:** P7.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Orchestrate the demand, inventory, expiry, FEFO, and replenishment-math engines into the single `Replenishment Recommendation` generator that writes to `p1.replenishment_recommendations` — the exact object that Phase 20 will hand off to PR2.

**CREATE:**
- `/p1-backend/src/services/recommendationService.ts` (orchestrator: pulls demand + inventory + expiry data, calls the pure engines, writes a recommendation row per Section 4's schema)
- `/p1-backend/src/services/recommendationService.test.ts` (integration-style test against a test/staging dataset or mocked Supabase client)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/engine/*.ts`, `/p1-backend/src/services/demandService.ts`, `/p1-backend/src/services/inventoryService.ts`, `/shared/contracts/replenishmentRecommendation.schema.json`

**Implementation Instructions:**
1. For a given SKU/DC (or run across all SKU/DC combos), pull demand signals (`demandService`), inventory batches (`inventoryService`), compute expiry risk (`expiryRiskEngine`), FEFO order (`fefoEngine`), and safety stock/ROP/EOQ (`replenishmentMathEngine`).
2. Determine urgency (`LOW/MEDIUM/HIGH/CRITICAL`) using a documented deterministic rule (e.g., based on days-of-cover remaining vs lead time, and/or expiry risk overlap).
3. Write a row to `p1.replenishment_recommendations` matching the schema in Section 7.1 and the contract in Section 4. Leave `aiRationale` as an empty string / null for now — Phase 22 fills it in.
4. Do not call PR2 or Gemini from this file — this prompt only produces the recommendation record; Phase 20 handles sending it onward, Phase 22 handles the AI rationale text.

**Constraints:** No AI calls. No calls to PR2. This service must be independently testable/runnable without either.

**Acceptance Criteria:**
- [ ] Running the generator against seeded data produces recommendation rows for the 3–5 deliberately-low-stock SKU/DC combos noted in P3.1's completion report.
- [ ] `urgency` values vary sensibly across different scenarios (not all the same).
- [ ] Output object shape matches the Section 4 contract exactly (minus the not-yet-populated `aiRationale`).

**Testing Requirements:** Run the integration test against seeded data; manually inspect at least 2 generated recommendations for plausibility.

**Completion Report:** Report how many recommendations were generated from seed data, list 2–3 example urgency classifications with the reasoning, confirm schema conformance.

---

# PHASE 8 — P1 APIs

### P8.1 — Replenishment REST Endpoints + API Tests
**Phase:** 8 — P1 APIs
**Type:** [SEQUENTIAL] (blocks Phase 9, Phase 20)
**Dependencies:** P7.2

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Expose the replenishment recommendation engine over REST per Section 13.1, and add an API-level test suite covering the full P1 surface.

**CREATE:**
- `/p1-backend/src/routes/replenishmentRoutes.ts` (`GET /api/replenishment/recommendations`, `POST /api/replenishment/recalculate`, `GET /api/replenishment/recommendations/:id`)
- `/p1-backend/src/routes/skuRoutes.ts` (`GET /api/skus`)
- `/p1-backend/src/routes/dcRoutes.ts` (`GET /api/distribution-centers`)
- `/p1-backend/tests/api.integration.test.ts` (hits the running server / an in-process app instance across the full P1 route surface)

**MODIFY:** `/p1-backend/src/index.ts` (mount the three new route files)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/services/**`, `/p1-backend/src/engine/**`

**Implementation Instructions:**
1. Implement the routes exactly as named in Section 13.1.
2. `POST /api/replenishment/recalculate` triggers `recommendationService`'s generator run and returns a summary (count generated, by urgency).
3. Validate query/path params with `zod`; return 404 for unknown recommendation IDs.
4. Integration test suite should cover: SKUs list, DCs list, inventory, demand signals, recalculate, list recommendations, get-by-id (happy path + 404 case).

**Constraints:** No new business logic — this prompt only wires existing services to HTTP. Do not modify engine or service files.

**Acceptance Criteria:**
- [ ] All routes from Section 13.1 (P1 portion) are implemented and mounted.
- [ ] Integration test suite passes against seeded data.
- [ ] 404 handling works for unknown IDs.

**Testing Requirements:** Run the integration test suite; manually `curl` each endpoint once.

**Completion Report:** List all mounted routes with example `curl` commands, confirm test pass count, flag readiness for Phase 9 (frontend) and Phase 20 (handoff) to consume this API.

---

# PHASE 9 — P1 Frontend

### P9.1 — Planner Dashboard Shell + Routing + Auth Guard Stub
**Phase:** 9 — P1 frontend
**Type:** [SEQUENTIAL] (blocks P9.2)
**Dependencies:** P1.2, P8.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Build the Planner dashboard shell: layout, navigation, routing, and a placeholder auth guard (real Supabase Auth wiring comes in Phase 23) so P9.2 can drop real views into a working shell.

**CREATE:**
- `/frontend/src/pages/planner/PlannerLayout.tsx`
- `/frontend/src/pages/planner/PlannerHome.tsx` (placeholder landing content)
- `/frontend/src/api/p1Client.ts` (axios instance pointed at `VITE_P1_API_BASE`)
- `/frontend/src/hooks/useAuthStub.ts` (temporary stub returning a fake logged-in Planner user; replaced by Phase 23's real hook)
- `/frontend/src/components/NavBar.tsx`

**MODIFY:** `/frontend/src/App.tsx` (add `/planner/*` routes using `react-router-dom`), `/.env.example` (add `VITE_P1_API_BASE`, `VITE_PR2_API_BASE`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend/src/pages/procurement/**` (do not touch — owned by Phase 19)

**Implementation Instructions:**
1. Build a simple sidebar/topbar layout (`PlannerLayout.tsx`) with nav links for: Inventory, Expiry Risk, Replenishment Recommendations, Demand Signals — actual content pages come in P9.2.
2. `p1Client.ts` should be a thin axios wrapper other planner components import instead of raw axios calls.
3. `useAuthStub.ts` is explicitly temporary — comment clearly that Phase 23 replaces it with real Supabase Auth session handling; other components should depend on the *hook's return shape* (`{ user, role, loading }`), not its implementation, so the swap in Phase 23 is a one-file change.
4. Style with Tailwind per Section 5.2; keep it clean and functional over decorative — this is a working demo tool, not a polished product.

**Constraints:** Do not implement real authentication here. Do not touch `/frontend/src/pages/procurement/**`.

**Acceptance Criteria:**
- [ ] Navigating to `/planner` shows the shell with working nav links (even if pages are placeholders).
- [ ] `p1Client.ts` successfully calls `GET /api/skus` and logs the response (temporary console.log acceptable, removed once P9.2 lands).

**Testing Requirements:** Manual browser check of `/planner` route and nav; confirm `p1Client` reaches the live P1 backend.

**Completion Report:** Confirm shell renders, confirm live API connectivity, note the auth hook contract other components should rely on.

---

### P9.2 — Inventory, Expiry Heatmap, and Replenishment Recommendation Views
**Phase:** 9 — P1 frontend
**Type:** [SEQUENTIAL]
**Dependencies:** P9.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Build the real Planner dashboard content: current inventory view, expiry-risk heatmap, and the replenishment recommendations/alerts panel — the core of the demo's opening screen (Section 16, step 1–2).

**CREATE:**
- `/frontend/src/pages/planner/InventoryView.tsx`
- `/frontend/src/pages/planner/ExpiryHeatmap.tsx` (Recharts-based grid/heatmap visualization)
- `/frontend/src/pages/planner/RecommendationsView.tsx` (list of replenishment recommendations with urgency badges)
- `/frontend/src/pages/planner/DemandSpikeSimulator.tsx` (a button/form that calls `POST /api/demand-signals` then `POST /api/replenishment/recalculate`, to drive the live demo narrative from Section 16 step 2)

**MODIFY:** `/frontend/src/App.tsx` (wire the new pages into the `/planner/*` routes created in P9.1), `/frontend/src/pages/planner/PlannerLayout.tsx` (only to activate nav links that were previously placeholders — do not restructure the layout)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend/src/api/p1Client.ts`, `/frontend/src/hooks/useAuthStub.ts`

**Implementation Instructions:**
1. `InventoryView.tsx`: table of SKU/DC current stock, sortable/filterable, pulling from `GET /api/inventory`.
2. `ExpiryHeatmap.tsx`: visual grid (SKU × DC or SKU × batch) color-coded by expiry risk classification from Phase 6 — use Recharts or a simple styled grid if Recharts doesn't suit a heatmap well; prioritize clarity for judges over chart-library purity.
3. `RecommendationsView.tsx`: list/cards of recommendations from `GET /api/replenishment/recommendations`, showing urgency badge, recommended qty, and (once Phase 22 lands) the AI rationale text — render gracefully if `aiRationale` is empty for now.
4. `DemandSpikeSimulator.tsx`: a simple form (pick SKU/DC, set adjustment %) that triggers the exact Section 16 step-2 demo moment; on success, refresh the recommendations view.

**Constraints:** These views read data only via `p1Client.ts` — no direct Supabase client calls from the frontend for this data (keeps a single source of truth through the backend's business logic). Realtime auto-refresh is out of scope here — Phase 21 adds it; for now, a manual "Refresh" button or refetch-on-action is sufficient.

**Acceptance Criteria:**
- [ ] All three views render real seeded data correctly.
- [ ] Expiry heatmap visually distinguishes CRITICAL/WARNING/OK batches.
- [ ] Demand Spike Simulator successfully creates a new recommendation end-to-end and it appears in the Recommendations view after refresh.

**Testing Requirements:** Manual walkthrough of Section 16 steps 1–2 in a browser against the live P1 backend and seeded data.

**Completion Report:** Confirm all views render correctly against live data, confirm the spike simulator produces a new recommendation, note anything deferred to Phase 21/22/23.

---

# PHASE 10 — PR2 Supplier Selection

### P10.1 — Supplier Entity + Deterministic Scoring Engine
**Phase:** 10 — PR2 supplier selection
**Type:** [SEQUENTIAL] (blocks Phase 13)
**Dependencies:** P4.2, P3.2

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the `suppliers` JPA entity and the deterministic weighted-scoring engine used to select a supplier for a requisition, per Section 3 (Sourcing & PO) and Section 5.1.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/sourcing/Supplier.java` (JPA entity, fields per Section 7.2)
- `/pr2-backend/src/main/java/com/chainvision/pr2/sourcing/SupplierRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/sourcing/SupplierScoringEngine.java` (pure/deterministic weighted-score function: price index, lead time, OTD score, quality score, capacity — documented weights)
- `/pr2-backend/src/main/java/com/chainvision/pr2/sourcing/SupplierController.java` (`GET /api/suppliers`)
- `/pr2-backend/src/test/java/com/chainvision/pr2/sourcing/SupplierScoringEngineTest.java`

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/infra/supabase/migrations/0003_pr2_tables.sql`

**Implementation Instructions:**
1. `Supplier.java` maps exactly to the `pr2.suppliers` table from Section 7.2.
2. `SupplierScoringEngine.java`: a plain Java class/service with a pure method, e.g. `score(Supplier s, int requiredCapacity)`, combining normalized price/lead-time/OTD/quality into a single weighted score with documented weights (e.g., 30% price, 25% lead time, 25% OTD, 20% quality — pick concrete numbers and comment them). Must reject/penalize suppliers below `requiredCapacity`.
3. This class must have **zero dependency on Gemini or any AI call** — it is pure arithmetic, unit-testable without Spring context.
4. `SupplierController` exposes a simple read endpoint for the frontend supplier list view (Phase 19).

**Constraints:** No AI calls anywhere in this prompt. Do not implement PO generation here (Phase 13) or requisition logic (Phase 11).

**Acceptance Criteria:**
- [ ] `SupplierScoringEngine` produces a clearly different top choice for a "cheap but unreliable" vs "expensive but high-performing" seeded supplier, exercised in unit tests.
- [ ] `GET /api/suppliers` returns all seeded suppliers correctly.

**Testing Requirements:** Run `SupplierScoringEngineTest`; `curl /api/suppliers` against seeded data.

**Completion Report:** State the exact scoring weights used (for demo defensibility), confirm test results, confirm endpoint output.

---

# PHASE 11 — PR2 Requisitions

### P11.1 — Requisition Entity, Manual Creation, and Handoff Receiver Endpoint
**Phase:** 11 — PR2 requisitions
**Type:** [SEQUENTIAL] (blocks Phase 13, Phase 20)
**Dependencies:** P4.2, P3.2

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the `purchase_requisitions` entity and both creation paths: manual/system, and the P1→PR2 handoff receiver that Phase 20 will call.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/PurchaseRequisition.java` (JPA entity per Section 7.2)
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/PurchaseRequisitionRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/RequisitionService.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/RequisitionController.java` (`POST /api/requisitions`, `POST /api/requisitions/from-recommendation`, `GET /api/requisitions`)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/dto/ReplenishmentRecommendationDto.java`, `/infra/supabase/migrations/0003_pr2_tables.sql`

**Implementation Instructions:**
1. `PurchaseRequisition.java` maps to `pr2.purchase_requisitions` (Section 7.2): includes `recommendation_id` (nullable), `source` enum (SYSTEM, CHATBOT, MANUAL), `raw_nl_input` (nullable), `status` enum (CREATED, SOURCED, PO_RAISED).
2. `POST /api/requisitions`: accepts a manually-entered requisition body (`source = MANUAL`), validates and persists.
3. `POST /api/requisitions/from-recommendation`: accepts a `ReplenishmentRecommendationDto` payload (this is the exact endpoint Phase 20 will call from P1), maps it into a requisition with `source = SYSTEM` and `recommendation_id` set from the incoming payload's `recommendationId`, `status = CREATED`.
4. Leave a clearly-marked extension point (e.g., a `createFromChatbotIntent(...)` method stub with a `// TODO: wired by Phase 12` comment) for Phase 12 to plug the Gemini-derived intent path into, without Phase 12 needing to touch this file's core structure.

**Constraints:** No AI calls in this prompt. Do not implement supplier selection or PO logic here.

**Acceptance Criteria:**
- [ ] `POST /api/requisitions` creates a MANUAL requisition correctly.
- [ ] `POST /api/requisitions/from-recommendation` creates a SYSTEM requisition correctly with `recommendation_id` populated.
- [ ] `GET /api/requisitions` lists all, filterable by `status`/`source`.

**Testing Requirements:** `curl` both creation endpoints with sample payloads matching the Section 4 contract shape; confirm rows persist correctly; confirm list endpoint reflects them.

**Completion Report:** Confirm both creation paths work, confirm the exact request shape expected by `/from-recommendation` (for Phase 20 to match), flag the extension point left for Phase 12.

---

# PHASE 12 — Gemini NLP

### P12.1 — Gemini Client Wrapper + Intent Extraction Endpoint
**Phase:** 12 — Gemini NLP
**Type:** [SEQUENTIAL]
**Dependencies:** P11.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the natural-language requisition intent extraction feature required by the demo ("We need 5,000 more units of MED-104 for the flu season."), using the free-tier Gemini API per Section 9.1, and wire it into the requisition creation path.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/ai/GeminiClient.java` (thin wrapper around the Gemini REST API; reads `GEMINI_API_KEY`/`GEMINI_MODEL` from config; exposes a generic `generateJson(String prompt, String schemaHint)` method)
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/IntentExtractionService.java` (builds the intent-extraction prompt, calls `GeminiClient`, parses the returned JSON into `{ skuGuess, quantity, dcGuess, urgency, confidence }`, with defensive try/catch and a clear fallback path if parsing fails)
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/dto/IntentExtractionResult.java`

**MODIFY:** `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/RequisitionController.java` (add `POST /api/requisitions/parse-intent`, which calls `IntentExtractionService` and returns the structured guess — does NOT auto-create a requisition, leaves that as a follow-up confirm step per Section 9's hard rule), `/pr2-backend/src/main/resources/application.yml` (add `gemini.api-key`, `gemini.model` config keys), `/.env.example` (add `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.0-flash`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/RequisitionService.java` (read for context on how a requisition is finally created — do not modify its core logic beyond adding the controller endpoint above)

**Implementation Instructions:**
1. `GeminiClient.java`: call the Gemini REST endpoint (`generateContent`) with the API key from config; request `responseMimeType: application/json` if available for the model version in use; return the raw text/JSON string.
2. `IntentExtractionService.java`: builds a prompt instructing Gemini to extract `{ skuGuess, quantity, dcGuess, urgency, confidence }` from free text like the exact demo example ("We need 5,000 more units of MED-104 for the flu season."). Parse defensively — on JSON parse failure, return a result with `confidence: 0` and a flag indicating manual entry is needed, never throw an unhandled exception up to the controller.
3. `POST /api/requisitions/parse-intent` takes `{ text: string }` and returns the structured guess — this pre-fills a form on the frontend (Phase 19), it does **not** auto-create the requisition record itself, per the hard rule in Section 9 that AI never bypasses deterministic confirmation.
4. Add clear code comments citing Section 9's hard rule: Gemini's output here only pre-fills; a human/UI-confirm step (or the existing `POST /api/requisitions` manual endpoint) is what actually persists it.

**Constraints:** This is the **only** place in PR2 that should call Gemini for intent extraction. Do not have this service or any other engine perform quantity/urgency *decisions* — Gemini's `quantity`/`urgency` output is a **guess for the user to confirm**, not an authoritative value.

**Acceptance Criteria:**
- [ ] `POST /api/requisitions/parse-intent` with the exact demo sentence returns a structured guess with `skuGuess` resolving to `MED-104` (or the closest seeded SKU code) and `quantity` around 5000.
- [ ] Malformed/unparseable Gemini responses are caught and returned as a low-confidence result, not a 500 error.
- [ ] No requisition row is created by this endpoint alone.

**Testing Requirements:** Manually `curl` the endpoint with the exact demo sentence and at least one deliberately ambiguous sentence; confirm graceful handling of a simulated Gemini failure (e.g., temporarily invalid API key) — should return a safe fallback response, not crash the server.

**Completion Report:** Confirm the demo sentence produces the expected structured guess, confirm fallback behavior on parse failure, confirm this endpoint does not persist data on its own.

---

# PHASE 13 — Purchase Orders

### P13.1 — Purchase Order Entity, Generation Logic, and Endpoints
**Phase:** 13 — Purchase orders
**Type:** [SEQUENTIAL] (blocks Phase 14)
**Dependencies:** P10.1, P11.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement PO generation: given a requisition, select the best supplier via `SupplierScoringEngine`, and auto-generate a Purchase Order, per Section 3 (Sourcing & PO) and Section 13.2.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/PurchaseOrder.java` (JPA entity per Section 7.2)
- `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/PurchaseOrderRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/PurchaseOrderService.java` (orchestrates: fetch requisition → call `SupplierScoringEngine` → compute unit price/total → persist PO → update requisition status to `PO_RAISED`)
- `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/PurchaseOrderController.java` (`POST /api/purchase-orders/{requisitionId}`, `GET /api/purchase-orders`, `GET /api/purchase-orders/{id}`)

**MODIFY:** None (this prompt only creates new files that call into existing `SupplierScoringEngine`/`RequisitionService`/`RequisitionRepository` — no changes to their internals)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/sourcing/**`, `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/**`

**Implementation Instructions:**
1. `PurchaseOrder.java` maps to `pr2.purchase_orders` (Section 7.2): `requisition_id`, `supplier_id`, `quantity`, `unit_price`, `total_amount`, `status` enum (ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED).
2. `PurchaseOrderService.generateFromRequisition(requisitionId)`: loads the requisition, calls `SupplierScoringEngine.score(...)` across all seeded suppliers to pick the winner, computes `unit_price` (from the winning supplier's price index applied to a base cost, or a straightforward simplification — document the assumption), sets `status = ISSUED`, persists, and flips the source requisition's `status` to `PO_RAISED`.
3. `POST /api/purchase-orders/{requisitionId}` is the trigger endpoint for both the system-generated and manual/chatbot demo paths described in Section 16 step 5.

**Constraints:** No AI calls. Supplier selection must go through `SupplierScoringEngine` only — do not duplicate scoring logic here.

**Acceptance Criteria:**
- [ ] Calling the generation endpoint against a seeded requisition produces a PO with a supplier chosen consistently with `SupplierScoringEngine`'s output.
- [ ] Requisition status flips to `PO_RAISED` after PO generation.
- [ ] `GET /api/purchase-orders` and `/:id` work correctly.

**Testing Requirements:** `curl` the generation endpoint against a seeded requisition; confirm the chosen supplier matches what `SupplierScoringEngineTest` would predict for that requirement; confirm requisition status update.

**Completion Report:** Confirm PO generation works end-to-end from a requisition, state which supplier was chosen and why (score breakdown) for one example run.

---

# PHASE 14 — Goods Receipt

### P14.1 — Goods Receipt Entity + Simulated Receipt Endpoint
**Phase:** 14 — Goods receipt
**Type:** [SEQUENTIAL] (blocks Phase 16, 17)
**Dependencies:** P13.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the simulated goods-receipt flow per Section 3 (Receiving): a one-click "Mark as Received" action generating a GRN.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/goodsreceipt/GoodsReceipt.java` (JPA entity per Section 7.2)
- `/pr2-backend/src/main/java/com/chainvision/pr2/goodsreceipt/GoodsReceiptRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/goodsreceipt/GoodsReceiptService.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/goodsreceipt/GoodsReceiptController.java` (`POST /api/goods-receipts`, `GET /api/goods-receipts`)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/**`

**Implementation Instructions:**
1. `GoodsReceipt.java` maps to `pr2.goods_receipts` (Section 7.2): `po_id`, `received_qty`, `batch_no`, `expiry_date`, `received_at`.
2. `POST /api/goods-receipts` accepts `{ poId, receivedQty, batchNo, expiryDate }`, persists the GRN, and updates the source PO's `status` to `RECEIVED` (or `PARTIALLY_RECEIVED` if `receivedQty` < PO `quantity` — implement this simple comparison).
3. This is deliberately simple/simulated — no real IoT/CV integration per Section 3's explicit note; it's a one-click demo action.

**Constraints:** No AI calls. Do not touch invoice logic (Phase 16).

**Acceptance Criteria:**
- [ ] Submitting a receipt against a seeded PO creates a GRN and updates PO status correctly.
- [ ] Partial receipt (received qty < PO qty) sets `PARTIALLY_RECEIVED`.

**Testing Requirements:** `curl` the endpoint with a full-quantity and a partial-quantity receipt against two different seeded POs; confirm status transitions.

**Completion Report:** Confirm both full and partial receipt scenarios work, confirm PO status transition logic.

---

# PHASE 15 — Tesseract.js OCR

### P15.1 — OCR Text Extraction Endpoint (P1/Node, Tesseract.js)
**Phase:** 15 — Tesseract.js OCR
**Type:** [SEQUENTIAL] (blocks Phase 16)
**Dependencies:** P4.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement raw OCR text extraction using Tesseract.js as an internal endpoint hosted on the P1/Node backend (per the Architecture Note — Tesseract.js is a JS library, so it lives in the Node service even though invoice orchestration lives in PR2/Java), which PR2 will call over HTTP during invoice processing.

**CREATE:**
- `/p1-backend/src/services/ocrService.ts` (wraps `tesseract.js`; exposes `extractText(fileBuffer, mimeType): Promise<string>`)
- `/p1-backend/src/routes/internalOcrRoutes.ts` (`POST /internal/ocr/extract`, multipart file upload, protected by a simple internal API key header — not full user auth, since this is a service-to-service call)

**MODIFY:** `/p1-backend/src/index.ts` (mount `internalOcrRoutes`), `package.json` (add `tesseract.js`, `multer` for file upload handling), `/.env.example` (add `INTERNAL_API_KEY`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`

**Implementation Instructions:**
1. `ocrService.ts`: use `tesseract.js`'s `recognize()` to extract raw text from an uploaded image. If the uploaded file is a PDF, note in code comments that a PDF-to-image pre-conversion step (e.g., `pdf-to-img` or similar) is needed — implement it or clearly flag it as a known limitation for Phase 16/24 to handle with a fallback.
2. `POST /internal/ocr/extract`: accepts a multipart file, requires a header `x-internal-key` matching `INTERNAL_API_KEY` (simple shared-secret check, not full JWT — this is backend-to-backend only), returns `{ rawText: string }`.
3. Keep this endpoint dumb and single-purpose: raw text out, no field parsing, no AI calls — that happens in Phase 16.

**Constraints:** No AI calls in this prompt. No field-level parsing logic here — just raw text extraction.

**Acceptance Criteria:**
- [ ] Uploading one of the 3 sample invoice images from P3.2 returns recognizable raw text containing the invoice number, quantities, and amounts (even if formatting is messy — that's expected of raw OCR).
- [ ] Requests without the correct `x-internal-key` are rejected with 401.

**Testing Requirements:** `curl -F` upload each of the 3 sample invoices from `/shared/seed-data/sample_invoices/`; visually confirm the raw text output contains the expected numbers.

**Completion Report:** Confirm raw text output for each sample invoice (paste a short excerpt), confirm auth header enforcement works, flag the PDF-to-image conversion approach used (or the limitation, if deferred).

---

# PHASE 16 — Invoice Processing

### P16.1 — Invoice Entity, Upload Endpoint, OCR + Gemini Structuring Pipeline
**Phase:** 16 — Invoice processing
**Type:** [SEQUENTIAL] (blocks Phase 17)
**Dependencies:** P14.1, P15.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement invoice upload on the PR2 side: call the Tesseract OCR endpoint (Phase 15) for raw text, then call Gemini to structure that raw text into JSON fields, and persist the result — the core of Section 3's Invoicing stage.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/Invoice.java` (JPA entity per Section 7.2, including `raw_ocr_json` jsonb column)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/InvoiceRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/OcrClient.java` (calls P1's `POST /internal/ocr/extract` over HTTP with the internal API key)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/InvoiceStructuringService.java` (takes raw OCR text, calls `GeminiClient` from Phase 12 with a prompt asking for structured JSON: invoice number, PO number if present, line items, total, vendor name; defensive parsing with fallback to `status = PENDING_MATCH` + manual-review flag on failure)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/InvoiceController.java` (`POST /api/invoices/upload` multipart, `GET /api/invoices`, `GET /api/invoices/{id}`)

**MODIFY:** `/pr2-backend/src/main/resources/application.yml` (add `p1.ocr-endpoint-url`, `internal.api-key` config), `/.env.example` (add `P1_OCR_URL`, `INTERNAL_API_KEY` — must match P1's value from Phase 15)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/ai/GeminiClient.java`

**Implementation Instructions:**
1. `Invoice.java` maps to `pr2.invoices` (Section 7.2): `po_id` (nullable until matched), `invoice_number`, `vendor_name_ocr`, `quantity_ocr`, `unit_price_ocr`, `total_ocr`, `raw_ocr_json`, `uploaded_file_ref`, `status` enum (PENDING_MATCH, MATCHED, MISMATCHED, APPROVED, EXCEPTION).
2. `POST /api/invoices/upload`: accepts a multipart file → calls `OcrClient` (Phase 15's endpoint) for raw text → calls `InvoiceStructuringService` (Gemini) to convert raw text into structured JSON → persists an `Invoice` row with `status = PENDING_MATCH`.
3. `InvoiceStructuringService` prompt must explicitly ask Gemini to return **only** the extracted fields as JSON — no computation, no matching decisions, per Section 9/10's hard rule. Store the full Gemini JSON response in `raw_ocr_json`.
4. On any failure in the OCR call or Gemini structuring, still persist the invoice with whatever partial data is available, `status = PENDING_MATCH`, and a note in `raw_ocr_json` indicating manual review is needed — never drop the upload silently.

**Constraints:** Gemini is only used to structure already-extracted OCR text into JSON — it must never see the PO/GRN data or make a match decision (that's Phase 17). No AI-derived numeric value is treated as authoritative without going through the deterministic 3-way match in Phase 17.

**Acceptance Criteria:**
- [ ] Uploading each of the 3 sample invoices produces a persisted `Invoice` row with structured fields reasonably matching what's printed on the document.
- [ ] A simulated OCR/Gemini failure still results in a persisted row (not a lost upload), flagged for manual review.
- [ ] `GET /api/invoices` and `/:id` work correctly.

**Testing Requirements:** Upload all 3 sample invoices via `curl -F`; inspect persisted rows; simulate a failure (e.g., temporarily point `P1_OCR_URL` at a wrong port) and confirm graceful degradation.

**Completion Report:** Confirm structured extraction results for each of the 3 sample invoices (matching / qty-mismatch / price-mismatch), confirm failure-mode behavior, confirm this is ready for Phase 17's matching logic.

---

# PHASE 17 — 3-Way Matching

### P17.1 — Deterministic 3-Way Match Engine + Mismatch Explanation Hook
**Phase:** 17 — 3-way matching
**Type:** [SEQUENTIAL] (blocks Phase 18)
**Dependencies:** P16.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the deterministic 3-way match (PO vs GRN vs Invoice) per Section 3/17, and generate a Gemini-based plain-English explanation only when a mismatch occurs, per Section 9's rationale-generation rule.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/ThreeWayMatch.java` (JPA entity per Section 7.2)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/ThreeWayMatchRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/ThreeWayMatchEngine.java` (pure/deterministic comparison: PO quantity/price vs GRN received quantity vs Invoice quantity/price, with a documented tolerance, e.g. 2%)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/MismatchExplanationService.java` (calls `GeminiClient` **only after** `ThreeWayMatchEngine` has already determined MISMATCHED and computed the specific field/expected/actual/tolerance values — Gemini only phrases the explanation, per Section 9)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/ThreeWayMatchController.java` (`POST /api/invoices/{id}/match`)

**MODIFY:** `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/InvoiceController.java` (only to expose the new match trigger route if not already covered by the new controller — prefer keeping it in the new `ThreeWayMatchController` to avoid touching this file if possible; if a shared base path requires a small addition, keep the diff to the new route registration only)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/purchaseorder/**`, `/pr2-backend/src/main/java/com/chainvision/pr2/goodsreceipt/**`, `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/Invoice.java`, `/pr2-backend/src/main/java/com/chainvision/pr2/ai/GeminiClient.java`

**Implementation Instructions:**
1. `ThreeWayMatchEngine.match(po, grn, invoice)`: pure deterministic comparison — quantity match within tolerance, price match within tolerance — returns `{ qtyMatch: boolean, priceMatch: boolean, result: MATCHED|MISMATCHED, mismatchReason: string|null }`. This class must have zero AI dependency and be independently unit-testable.
2. `ThreeWayMatchController`'s `POST /api/invoices/{id}/match` loads the invoice + its linked PO + GRN, runs the engine, persists a `ThreeWayMatch` row, and updates the invoice's `status` to `MATCHED` or `MISMATCHED`.
3. Only when `result == MISMATCHED`, call `MismatchExplanationService`, which passes the already-computed `mismatchReason` (field, expected, actual, tolerance) into a Gemini prompt asking only for a one-sentence plain-English explanation — store it in `ai_explanation`. Never call Gemini on a MATCHED result (not needed, saves API quota).
4. Handle the case where an invoice doesn't yet have a resolved `po_id` (e.g., no automatic linkage from OCR) — for the hackathon, resolve the PO by looking up the `invoice_number`/`po_id` field Gemini extracted in Phase 16, or allow it to be passed explicitly in the match request body as a fallback.

**Constraints:** `ThreeWayMatchEngine` itself must never call Gemini. AI is explanation-only, applied strictly after the deterministic verdict.

**Acceptance Criteria:**
- [ ] Matching the "clean" sample invoice against its seeded PO/GRN produces `MATCHED`.
- [ ] Matching the quantity-mismatch sample produces `MISMATCHED` with a correct `mismatchReason` and a Gemini-generated `ai_explanation`.
- [ ] Matching the price-mismatch sample produces the analogous correct result.
- [ ] `ThreeWayMatchEngine` is unit tested independent of Spring context and Gemini.

**Testing Requirements:** Run `ThreeWayMatchEngine` unit tests (at least 4 cases: exact match, qty mismatch, price mismatch, both mismatch); `curl` the match endpoint for all 3 seeded sample invoices and confirm expected outcomes.

**Completion Report:** Confirm match results for all 3 sample invoices, quote one example Gemini-generated `ai_explanation` string, confirm the engine is Gemini-independent and unit tested.

---

# PHASE 18 — Payment Approval

### P18.1 — Payment Approval Logic + Exception Queue
**Phase:** 18 — Payment approval
**Type:** [SEQUENTIAL] (blocks Phase 19.3, Phase 26)
**Dependencies:** P17.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the final P2P stage: auto-approve payment on a MATCHED result, or route to an exception queue on MISMATCHED, per Section 3/17.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/payment/PaymentApproval.java` (JPA entity per Section 7.2)
- `/pr2-backend/src/main/java/com/chainvision/pr2/payment/PaymentApprovalRepository.java`
- `/pr2-backend/src/main/java/com/chainvision/pr2/payment/PaymentApprovalService.java` (on MATCHED → create `AUTO_APPROVED` row; on MISMATCHED → create `PENDING_REVIEW` row and flip invoice status to `EXCEPTION`)
- `/pr2-backend/src/main/java/com/chainvision/pr2/payment/PaymentApprovalController.java` (`GET /api/exceptions`, `POST /api/exceptions/{id}/resolve`)

**MODIFY:** `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/ThreeWayMatchController.java` (add a call to `PaymentApprovalService.processMatchResult(...)` immediately after persisting the match result — this is the only touch point in an existing file, keep the diff minimal and additive)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/**`

**Implementation Instructions:**
1. `PaymentApproval.java` maps to `pr2.payment_approvals` (Section 7.2): `invoice_id`, `status` enum (AUTO_APPROVED, PENDING_REVIEW, REJECTED, APPROVED_MANUAL), `approved_by`, `approved_at`.
2. `PaymentApprovalService.processMatchResult(invoiceId, matchResult)`: if `MATCHED`, create `AUTO_APPROVED` with `approved_at = now`, `approved_by = "SYSTEM"`; if `MISMATCHED`, create `PENDING_REVIEW`, leave `approved_by`/`approved_at` null, and set the related invoice's status to `EXCEPTION`.
3. `GET /api/exceptions`: lists invoices in `EXCEPTION` status joined with their `PENDING_REVIEW` payment approval and the `ai_explanation` from the 3-way match, for the Exception Queue UI (Phase 19).
4. `POST /api/exceptions/{id}/resolve`: accepts `{ decision: "APPROVE" | "REJECT", approvedBy: string }`, updates the `PaymentApproval` row to `APPROVED_MANUAL` or `REJECTED` accordingly.

**Constraints:** No AI calls in this prompt — the AI explanation was already generated in Phase 17 and is only read here, not regenerated.

**Acceptance Criteria:**
- [ ] Running the full flow on the clean sample invoice results in an `AUTO_APPROVED` payment approval.
- [ ] Running it on either mismatch sample results in a `PENDING_REVIEW` approval and the invoice appearing in `GET /api/exceptions` with its `ai_explanation` visible.
- [ ] Resolving an exception via the resolve endpoint updates its status correctly.

**Testing Requirements:** Run the full upload → match → payment pipeline for all 3 sample invoices end-to-end via `curl`; confirm exception queue contents; resolve one exception and confirm status change.

**Completion Report:** Confirm auto-approve and exception-routing both work correctly for the 3 sample invoices, confirm resolve endpoint works, note this completes the full PR2 backend pipeline described in Section 4.

---

# PHASE 19 — PR2 Frontend

### P19.1 — Procurement Dashboard Shell + Routing + Auth Guard Stub
**Phase:** 19 — PR2 frontend
**Type:** [SEQUENTIAL] (blocks P19.2, P19.3)
**Dependencies:** P1.2, P11.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Build the Procurement dashboard shell, mirroring the pattern established in P9.1, so P19.2/P19.3 can drop real views in.

**CREATE:**
- `/frontend/src/pages/procurement/ProcurementLayout.tsx`
- `/frontend/src/pages/procurement/ProcurementHome.tsx` (placeholder landing content)
- `/frontend/src/api/pr2Client.ts` (axios instance pointed at `VITE_PR2_API_BASE`)

**MODIFY:** `/frontend/src/App.tsx` (add `/procurement/*` routes)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend/src/pages/planner/**`, `/frontend/src/hooks/useAuthStub.ts` (reuse the existing stub, do not modify it), `/frontend/src/components/NavBar.tsx`

**Implementation Instructions:**
1. Mirror `PlannerLayout.tsx`'s structure/pattern for `ProcurementLayout.tsx`, with nav links for: Requisitions, Purchase Orders, Goods Receipt, Invoices, Exceptions, Analytics — content pages come in P19.2/P19.3.
2. `pr2Client.ts` is a thin axios wrapper for the PR2 API, analogous to `p1Client.ts`.
3. Reuse `useAuthStub.ts` from P9.1 as-is (it already returns a generic `{ user, role, loading }` shape) — do not duplicate or modify it.

**Constraints:** Do not touch `/frontend/src/pages/planner/**` or `useAuthStub.ts`.

**Acceptance Criteria:**
- [ ] Navigating to `/procurement` shows the shell with working nav links.
- [ ] `pr2Client.ts` successfully calls `GET /api/suppliers` and logs the response.

**Testing Requirements:** Manual browser check of `/procurement` route and nav; confirm live connectivity to the PR2 backend.

**Completion Report:** Confirm shell renders, confirm live API connectivity, confirm reuse of the shared auth stub.

---

### P19.2 — Requisition/PO/GRN Views + NL Requisition Chatbot
**Phase:** 19 — PR2 frontend
**Type:** [SEQUENTIAL]
**Dependencies:** P19.1, P12.1, P13.1, P14.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Build the requisition, PO, and GRN views, plus the natural-language chatbot input that demonstrates Gemini intent extraction — the demo's flagship "we need 5,000 more units of MED-104" moment (Section 16 step 4).

**CREATE:**
- `/frontend/src/pages/procurement/RequisitionsView.tsx` (list + manual create form)
- `/frontend/src/pages/procurement/NlRequisitionChatbot.tsx` (free-text input → calls `POST /api/requisitions/parse-intent` → pre-fills a confirm form → on confirm, calls `POST /api/requisitions`)
- `/frontend/src/pages/procurement/PurchaseOrdersView.tsx` (list + "Generate PO" action against a requisition)
- `/frontend/src/pages/procurement/GoodsReceiptView.tsx` ("Mark as Received" action against a PO)

**MODIFY:** `/frontend/src/pages/procurement/ProcurementLayout.tsx` (activate the corresponding nav links only — do not restructure layout), `/frontend/src/App.tsx` (wire new routes)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend/src/api/pr2Client.ts`

**Implementation Instructions:**
1. `RequisitionsView.tsx`: table/list of requisitions with `source` badge (SYSTEM/CHATBOT/MANUAL), status, and a manual-create form for ad hoc testing.
2. `NlRequisitionChatbot.tsx`: single text input + send button; on submit, calls `parse-intent`, displays the structured guess (SKU, quantity, DC, urgency, confidence) in an editable confirm form, and only calls `POST /api/requisitions` (with `source: CHATBOT`, `rawNlInput` set to the original text) once the user clicks "Confirm" — this UI flow must visibly demonstrate that Gemini's guess is a *suggestion requiring confirmation*, not an automatic action.
3. `PurchaseOrdersView.tsx`: list of POs with supplier name, price breakdown if available, and a "Generate PO" button next to `CREATED`-status requisitions that calls `POST /api/purchase-orders/{requisitionId}`.
4. `GoodsReceiptView.tsx`: list of `ISSUED`/`PARTIALLY_RECEIVED` POs with a "Mark as Received" action calling `POST /api/goods-receipts`.

**Constraints:** The chatbot flow must not skip the confirm step, per Section 9's hard rule — do not auto-submit on Gemini's response alone.

**Acceptance Criteria:**
- [ ] Typing the exact demo sentence into the chatbot produces a correct pre-filled confirm form, and confirming it creates a real requisition.
- [ ] PO generation and goods receipt actions work end-to-end from the UI against the live PR2 backend.

**Testing Requirements:** Manual walkthrough of Section 16 steps 4–6 in a browser.

**Completion Report:** Confirm the chatbot demo sentence works end-to-end through confirm, confirm PO/GRN actions work, note any UX rough edges deferred to Phase 28 polish.

---

### P19.3 — Invoice Upload, Exception Queue, and P2P Analytics View
**Phase:** 19 — PR2 frontend
**Type:** [SEQUENTIAL]
**Dependencies:** P19.1, P16.1, P17.1, P18.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Build the invoice upload UI, exception queue, and P2P analytics dashboard — the closing act of the demo (Section 16 steps 7–10).

**CREATE:**
- `/frontend/src/pages/procurement/InvoiceUploadView.tsx` (file upload → `POST /api/invoices/upload` → shows extracted fields → "Run 3-Way Match" button → shows result)
- `/frontend/src/pages/procurement/ExceptionQueueView.tsx` (lists `GET /api/exceptions`, shows `ai_explanation`, Approve/Reject actions calling `POST /api/exceptions/{id}/resolve`)
- `/frontend/src/pages/procurement/P2pAnalyticsView.tsx` (calls `GET /api/analytics/p2p-summary` — touchless %, cycle time, exception rate; if that endpoint doesn't exist yet, compute simple client-side aggregates from `GET /api/invoices` + `GET /api/exceptions` as an acceptable hackathon substitute, and note this clearly in the completion report)

**MODIFY:** `/frontend/src/pages/procurement/ProcurementLayout.tsx` (activate remaining nav links only), `/frontend/src/App.tsx` (wire new routes)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend/src/api/pr2Client.ts`, `/shared/seed-data/sample_invoices/**`

**Implementation Instructions:**
1. `InvoiceUploadView.tsx`: drag-and-drop or file-picker upload; after upload, display the Gemini-structured fields; provide a "Run 3-Way Match" button that calls the match endpoint and displays MATCHED/MISMATCHED with the reason/explanation inline.
2. `ExceptionQueueView.tsx`: card/list view of exceptions, each showing the mismatch reason and the Gemini-generated plain-English explanation prominently (this is a key judge-visible AI touchpoint), with Approve/Reject buttons.
3. `P2pAnalyticsView.tsx`: simple stat cards (touchless-processing %, invoices processed, exception rate, average cycle time) — computing touchless % as `AUTO_APPROVED / total processed` is an acceptable simplification; document the exact formula used in a code comment.

**Constraints:** Do not fabricate a backend analytics endpoint if `GET /api/analytics/p2p-summary` wasn't built — compute client-side from existing endpoints instead, and clearly flag this substitution.

**Acceptance Criteria:**
- [ ] Uploading all 3 sample invoices and running match/approval end-to-end is possible entirely from this UI (Section 16 steps 7–9).
- [ ] Exception queue correctly shows the two mismatch invoices with their AI explanations and allows resolving them.
- [ ] Analytics view shows a sane touchless % after processing all 3 sample invoices (expected ~33% given 1 of 3 auto-approves, until more are processed).

**Testing Requirements:** Full manual walkthrough of Section 16 steps 7–10 using the 3 seeded sample invoices.

**Completion Report:** Confirm full walkthrough success, state the exact touchless-% formula used, confirm this completes the PR2 frontend surface needed for the demo.

---

# PHASE 20 — P1 → PR2 Handoff

### P20.1 — Automatic Handoff Trigger + Retry Logic + Integration Test
**Phase:** 20 — P1 → PR2 handoff
**Type:** [SEQUENTIAL] (blocks Phase 26)
**Dependencies:** P8.1, P11.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Wire the automatic P1→PR2 handoff described as the centerpiece of Section 4: when P1 generates a recommendation with urgency ≥ MEDIUM, it must automatically call PR2's `from-recommendation` endpoint.

**CREATE:**
- `/p1-backend/src/services/pr2ClientService.ts` (calls `POST {PR2_BASE_URL}/api/requisitions/from-recommendation` with the recommendation payload; includes basic retry-once-on-failure logic and clear error logging)
- `/p1-backend/tests/handoff.integration.test.ts` (runs the full chain: create a demand spike → recalculate → confirm a PR2 requisition with matching `recommendation_id` exists, by calling PR2's `GET /api/requisitions` — this test talks to both live services)

**MODIFY:** `/p1-backend/src/services/recommendationService.ts` (add a call to `pr2ClientService` immediately after persisting a recommendation with urgency ≥ MEDIUM — keep this addition minimal and clearly marked, do not restructure the rest of the file)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/RequisitionController.java`, `/shared/contracts/replenishmentRecommendation.schema.json`

**Implementation Instructions:**
1. `pr2ClientService.ts`: a small typed HTTP client (axios) that posts the recommendation object exactly matching the JSON Schema in `/shared/contracts/replenishmentRecommendation.schema.json`. On failure (network error, non-2xx), retry once after a short delay, then log the failure clearly (full hardening/fallback UX comes in Phase 24 — this prompt just needs the retry-once behavior and a clear log line, not a full circuit breaker).
2. In `recommendationService.ts`, after successfully persisting a new recommendation, check `urgency !== 'LOW'` and call `pr2ClientService.sendRecommendation(recommendation)`; update the recommendation's local `status` field to `SENT_TO_PROCUREMENT` on success.
3. The integration test must exercise the real, live chain — not mocks — since this is the single most important cross-service behavior in the whole system.

**Constraints:** This prompt touches exactly one existing file (`recommendationService.ts`) with a small, additive change — do not refactor unrelated parts of it.

**Acceptance Criteria:**
- [ ] Triggering `POST /api/replenishment/recalculate` on P1 with a scenario that produces a HIGH/CRITICAL recommendation results in a new `SYSTEM`-sourced requisition appearing in PR2 within seconds.
- [ ] The requisition's `recommendation_id` matches the P1 recommendation's `id`.
- [ ] A LOW-urgency recommendation does NOT trigger a handoff call.
- [ ] A simulated PR2-unreachable scenario (e.g., wrong port temporarily) is retried once and then fails gracefully without crashing P1's recalculate call.

**Testing Requirements:** Run `handoff.integration.test.ts` against both live services; manually verify via `GET /api/requisitions` on PR2 after triggering a P1 recalculation.

**Completion Report:** Confirm the live end-to-end handoff works, confirm the LOW-urgency exclusion, confirm retry/failure behavior, state that this satisfies the Section 17 Definition-of-Done handoff requirement.

---

# PHASE 21 — Supabase Realtime

### P21.1 — Realtime Subscriptions for Both Dashboards
**Phase:** 21 — Supabase Realtime
**Type:** [SEQUENTIAL]
**Dependencies:** P2.1, P9.2, P19.2, P19.3

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Wire Supabase Realtime (per the Architecture Note, replacing the custom Socket.IO plan from Section 8) so both dashboards update live as recommendations, requisitions, POs, invoices, and payment approvals change — the visual "wow" moment for judges.

**CREATE:**
- `/frontend/src/hooks/useRealtimeTable.ts` (generic reusable hook: subscribes to a given Supabase table's postgres_changes channel, returns the latest change events for a component to react to)
- `/frontend/src/lib/supabaseClient.ts` (frontend Supabase client using `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, read-only usage — no service role key on the frontend)

**MODIFY:**
- `/frontend/src/pages/planner/RecommendationsView.tsx` (subscribe to `p1.replenishment_recommendations` via `useRealtimeTable` and auto-refresh the list on change — small, additive hook usage only)
- `/frontend/src/pages/procurement/RequisitionsView.tsx` (subscribe to `pr2.purchase_requisitions`, same pattern)
- `/frontend/src/pages/procurement/InvoiceUploadView.tsx` and `/frontend/src/pages/procurement/ExceptionQueueView.tsx` (subscribe to `pr2.invoices` and `pr2.payment_approvals` respectively, same pattern)
- `/.env.example` (add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/infra/supabase/migrations/*` (confirms which tables have replication enabled — do not modify)

**Implementation Instructions:**
1. `useRealtimeTable(schema, table, onChange)`: wraps `supabase.channel(...).on('postgres_changes', { event: '*', schema, table }, onChange).subscribe()`, with cleanup on unmount.
2. Each modified view should call this hook and, on any change event, simply re-run its existing data-fetch function (the goal is "the list refreshes itself," not necessarily granular diffing — simplicity over sophistication given the timeline).
3. Confirm Realtime is actually enabled on the specific tables being subscribed to (per P2.1's migration) — if a table isn't in the replication list, either use it anyway (Supabase will simply not fire events) and flag it, or ask the coordinator to re-run part of P2.1's migration.

**Constraints:** Do not embed the Supabase **service role** key in the frontend — only the public anon key, consistent with RLS read policies from P2.1.

**Acceptance Criteria:**
- [ ] Triggering a new recommendation via the Demand Spike Simulator (P9.2) causes the Recommendations view to update without a manual page refresh.
- [ ] Triggering a new requisition (via handoff or chatbot) causes the Requisitions view to update live.
- [ ] Uploading/matching an invoice causes the Exception Queue / Invoice view to update live.

**Testing Requirements:** Open both dashboards in two browser windows; trigger changes from one and visually confirm the other updates without a refresh.

**Completion Report:** Confirm which four views now have live updates, confirm anon-key-only usage on the frontend, flag any table missing from Realtime replication if discovered.

---

# PHASE 22 — Gemini Rationale

### P22.1 — Rationale Generation Wired Into P1 Recommendation Flow
**Phase:** 22 — Gemini rationale
**Type:** [SEQUENTIAL]
**Dependencies:** P7.2, P20.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Implement the P1-side Gemini rationale text generation described in Section 9.2, and wire it into the recommendation flow so every recommendation shown on the Planner dashboard carries a human-readable explanation.

**CREATE:**
- `/p1-backend/src/services/geminiClient.ts` (thin wrapper around the Gemini REST API, same pattern as PR2's `GeminiClient.java`, using `GEMINI_API_KEY`/`GEMINI_MODEL` from env)
- `/p1-backend/src/services/aiRationaleService.ts` (`generateRationale(recommendation): Promise<string>` — takes the *already-computed* numbers from `recommendationService` and asks Gemini only to phrase them; defensive try/catch returning a safe deterministic fallback string like `"Recommended {qty} units for {dc} — reorder point breached."` if Gemini fails)

**MODIFY:** `/p1-backend/src/services/recommendationService.ts` (after computing the recommendation object and before persisting it, call `aiRationaleService.generateRationale(...)` and set the `aiRationale` field — keep this addition minimal and clearly marked, matching the same pattern used in Phase 20's edit to this file), `/.env.example` (add `GEMINI_API_KEY`, `GEMINI_MODEL` if not already present from another phase — check first, don't duplicate)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/engine/**`

**Implementation Instructions:**
1. `geminiClient.ts` mirrors the Java version's contract: takes a prompt string, returns text (or requests JSON if needed elsewhere later — for rationale text, plain text output is fine).
2. `aiRationaleService.ts` builds a prompt with the exact computed numbers (recommended qty, urgency, DC, days-of-cover, reorder point) and asks Gemini for a single-paragraph, judge-readable rationale — mirroring the Section 9 example text.
3. The fallback string (used if Gemini errors or is rate-limited) must still be genuinely informative, not a generic "AI unavailable" message — construct it from the same numeric inputs deterministically.

**Constraints:** Gemini must only be given already-computed numbers — it must never be asked to compute or guess a quantity/urgency itself in this service.

**Acceptance Criteria:**
- [ ] New recommendations generated after this change have a non-empty, sensible `aiRationale` field.
- [ ] Simulating a Gemini failure (e.g., invalid key temporarily) still produces a usable fallback rationale, not an empty field or a crash.
- [ ] The Planner dashboard's Recommendations view (P9.2) now displays real rationale text instead of blank space.

**Testing Requirements:** Trigger a recalculation and inspect the `aiRationale` field on 2–3 resulting recommendations; simulate a Gemini failure and confirm fallback text appears instead.

**Completion Report:** Paste 1–2 example generated rationale strings, confirm fallback behavior works, confirm this closes out the P1-side half of Section 9.2's rationale requirement (PR2-side mismatch explanation was already completed in Phase 17).

---

# PHASE 23 — Supabase Auth

### P23.1 — Frontend Supabase Auth Integration
**Phase:** 23 — Supabase Auth
**Type:** [SEQUENTIAL] (blocks P23.2, P23.3 only loosely — they can proceed in parallel on the backend side once P2.1's users table exists, but this prompt finalizes the frontend contract both rely on)
**Dependencies:** P2.1, P9.1, P19.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Replace the temporary `useAuthStub.ts` with real Supabase Auth (login/session/role), and add route guards to both dashboards, per Section 11 (adapted for Supabase per the Architecture Note).

**CREATE:**
- `/frontend/src/pages/LoginPage.tsx` (email+password form using `supabase.auth.signInWithPassword`)
- `/frontend/src/hooks/useAuth.ts` (real replacement for `useAuthStub.ts`: wraps `supabase.auth.getSession()`/`onAuthStateChange`, fetches the user's `role` from the `users` table, exposes `{ user, role, loading, signOut }`)
- `/frontend/src/components/RequireRole.tsx` (route-guard wrapper component: redirects to `/login` if unauthenticated, or shows an "access denied" state if the role doesn't match the required role for that route)

**MODIFY:**
- `/frontend/src/App.tsx` (swap route guards from the stub to `RequireRole`, add `/login` route)
- `/frontend/src/pages/planner/RecommendationsView.tsx`, `/frontend/src/pages/procurement/RequisitionsView.tsx` (only the import line: swap `useAuthStub` → `useAuth` — no other logic changes, since P9.2/P19.1-3 already coded against the stub's `{ user, role, loading }` shape)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/frontend/src/lib/supabaseClient.ts` (created in Phase 21 — reuse it, do not duplicate), `/infra/supabase/migrations/0004_shared_users_and_rls.sql`

**Implementation Instructions:**
1. `useAuth.ts` must expose the exact same return shape as `useAuthStub.ts` (`{ user, role, loading }` plus a new `signOut` method) so every component written against the stub in earlier phases keeps working with only an import-line change.
2. `RequireRole` takes a `role` or `roles` prop and wraps a route element; unauthenticated → redirect to `/login`; authenticated but wrong role → simple "Access denied" message with a link back to their own dashboard.
3. `LoginPage.tsx` should be simple — email/password fields, a submit button, and error display on failed login (Section 11 explicitly scopes auth to email+password only, no OAuth/SSO/MFA).
4. Do not delete `useAuthStub.ts` — leave it in place but unused, in case any late-arriving prompt still references it; note this in the completion report so it can be cleaned up in Phase 28 polish.

**Constraints:** Do not modify backend files in this prompt (that's P23.2/P23.3). Keep the swap in P9.2/P19.1-3 files to the single import line described above.

**Acceptance Criteria:**
- [ ] Logging in as `planner@demo.com` / `demo1234` (created by Phase 3's user-seeding, coordinated with P23.2/3) grants access to `/planner/*` and redirects away from `/procurement/*`.
- [ ] Logging in as `procurement@demo.com` grants the inverse access.
- [ ] Logging out and visiting either dashboard route redirects to `/login`.

**Testing Requirements:** Manual login/logout/role-mismatch walkthrough for both demo accounts.

**Completion Report:** Confirm role-gating works for both demo accounts, confirm the stub-to-real-hook swap only touched import lines, flag `useAuthStub.ts` as safe-to-delete in Phase 28.

---

### P23.2 — P1 Backend Supabase JWT Verification Middleware
**Phase:** 23 — Supabase Auth
**Type:** [PARALLEL] (can run alongside P23.3)
**Dependencies:** P2.1, P4.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Add middleware to the P1/Node backend that verifies incoming Supabase-issued JWTs on user-facing routes (not the internal service-to-service routes from Phase 15/20, which use the separate internal API key).

**CREATE:**
- `/p1-backend/src/auth/verifySupabaseJwt.ts` (Express middleware: validates the `Authorization: Bearer <token>` header against Supabase's JWKS/public key or via `supabase.auth.getUser(token)`; attaches `{ userId, role }` to the request on success, returns 401 on failure)

**MODIFY:**
- `/p1-backend/src/routes/replenishmentRoutes.ts`, `/p1-backend/src/routes/inventoryRoutes.ts`, `/p1-backend/src/routes/demandRoutes.ts`, `/p1-backend/src/routes/skuRoutes.ts`, `/p1-backend/src/routes/dcRoutes.ts` (apply `verifySupabaseJwt` as route-level middleware only — do not change any handler logic)
- `/.env.example` (confirm `SUPABASE_URL` is present, needed for JWT verification — likely already added in Phase 4)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/routes/internalOcrRoutes.ts` (uses the separate internal-key auth from Phase 15 — do not add Supabase JWT checking here, it would break the P1→PR2 handoff and OCR service calls)

**Implementation Instructions:**
1. Use Supabase's server-side verification approach (either `supabase.auth.getUser(token)` using the service role client, or manual JWKS verification) — pick whichever is simpler to implement correctly within the timeline; document the choice.
2. Apply the middleware to all P1 *user-facing* route files listed above. Do not apply it to `/internal/*` routes (Phase 15's OCR endpoint, Phase 20's internal realtime relay if any) — those use a separate shared-secret scheme intentionally, since they're service-to-service.
3. On success, attach `req.user = { id, role }` so downstream handlers could use it if needed (not required for this hackathon's authorization granularity beyond route-level gating, but useful for logging).

**Constraints:** Do not touch handler logic inside the route files — only add the middleware to the router chain.

**Acceptance Criteria:**
- [ ] Requests to any P1 user-facing route without a valid token return 401.
- [ ] Requests with a valid Supabase session token (obtained via the frontend login from P23.1) succeed.
- [ ] The internal OCR endpoint remains unaffected and still works with just the internal API key.

**Testing Requirements:** `curl` a protected route with no token (expect 401), with an invalid token (expect 401), and with a real token obtained from a logged-in frontend session (expect 200); re-run Phase 15's OCR curl test to confirm it's unaffected.

**Completion Report:** Confirm 401 behavior on missing/invalid tokens, confirm success with a real session token, confirm internal routes are unaffected.

---

### P23.3 — PR2 Backend Supabase JWT Verification (Spring Security)
**Phase:** 23 — Supabase Auth
**Type:** [PARALLEL] (can run alongside P23.2)
**Dependencies:** P2.1, P4.2

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Configure Spring Security on the PR2 backend to verify Supabase-issued JWTs on user-facing routes, mirroring P23.2's behavior on the Java side.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/security/SupabaseJwtAuthFilter.java` (extracts and validates the `Authorization: Bearer <token>` header against Supabase's public key/JWKS)
- `/pr2-backend/src/main/java/com/chainvision/pr2/security/SecurityConfig.java` (Spring Security filter chain config: permits `/health` and `/api/*/from-recommendation`-style internal-only endpoints via a separate internal-key check if applicable, requires valid JWT on all other `/api/**` routes)

**MODIFY:** `/pr2-backend/src/main/resources/application.yml` (add Supabase JWKS/public key config), `/.env.example` (confirm `SUPABASE_URL` present)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/RequisitionController.java` (do not modify — only affected via the security filter chain config, not direct edits), all other `**/Controller.java` files (same — security applies at the filter-chain level, not per-controller edits)

**Implementation Instructions:**
1. Implement `SupabaseJwtAuthFilter` as a `OncePerRequestFilter` that validates the JWT against Supabase's JWKS endpoint (fetchable from `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` or the equivalent Supabase-documented endpoint) and sets the Spring Security context on success.
2. `SecurityConfig` should explicitly permit `/health` without auth. For `POST /api/requisitions/from-recommendation` (called by P1, not a logged-in user) — since it's a service-to-service call, either (a) also protect it with the same `INTERNAL_API_KEY` header check used in Phase 15/16 instead of a user JWT, configured as a separate exempted-but-key-checked route, or (b) require the P1 service to obtain and pass a Supabase service-role-derived token. Prefer option (a) for consistency with the existing internal-key pattern already established — implement accordingly and clearly document the choice.
3. All other `/api/**` routes require a valid Supabase JWT.

**Constraints:** Do not modify any `*Controller.java` file directly — all access control must live in the filter/security-config layer.

**Acceptance Criteria:**
- [ ] Requests to protected PR2 routes without a valid token return 401.
- [ ] Requests with a valid Supabase session token succeed.
- [ ] `POST /api/requisitions/from-recommendation` continues to work from P1's `pr2ClientService` (Phase 20) using the internal-key scheme, unaffected by the new user-JWT requirement.
- [ ] `/health` remains open.

**Testing Requirements:** `curl` a protected route with no/invalid/valid tokens; re-run Phase 20's handoff integration test to confirm the internal route still works after this change.

**Completion Report:** Confirm 401/200 behavior on user routes, confirm the internal `from-recommendation` route is unaffected, state which of the two internal-auth options (a/b) was implemented and why.

---

# PHASE 24 — Error Handling and Fallbacks

### P24.1 — P1 Backend Error Handling + AI/OCR Fallbacks
**Phase:** 24 — Error handling and fallbacks
**Type:** [PARALLEL]
**Dependencies:** P4.1, P22.1, P15.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Harden the P1 backend's error handling beyond the Phase 4 skeleton, with particular attention to Gemini rate-limit/failure scenarios (the highest-risk external dependency given 15 teams sharing free-tier quota) and Tesseract OCR failures.

**CREATE:**
- `/p1-backend/src/middleware/rateLimitAwareRetry.ts` (a small utility used by `geminiClient.ts` to detect 429/rate-limit responses and back off/retry with jitter, up to a max of 2 retries, then fall through to the deterministic fallback text already built in Phase 22)

**MODIFY:**
- `/p1-backend/src/middleware/errorHandler.ts` (expand from the Phase 4 skeleton: distinguish validation errors (400), not-found (404), upstream/AI failures (502 with a clear message), and unexpected errors (500 with a generic safe message, full error logged server-side only)
- `/p1-backend/src/services/geminiClient.ts` (wrap calls with `rateLimitAwareRetry`)
- `/p1-backend/src/services/ocrService.ts` (add a try/catch around Tesseract calls returning a clear typed error rather than an unhandled rejection)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/p1-backend/src/services/aiRationaleService.ts` (its existing fallback string logic from Phase 22 stays as-is — this prompt only makes the retry path around it more robust, doesn't change the fallback content)

**Implementation Instructions:**
1. `rateLimitAwareRetry.ts`: a generic wrapper function `withRetry(fn, { maxRetries: 2, baseDelayMs: 500 })` usable by any external-API call site.
2. Expand `errorHandler.ts` to produce consistent JSON error shapes (`{ error: { code, message } }`) across the whole P1 API surface, and to never leak stack traces to the client.
3. Confirm that when Gemini fails even after retries, `aiRationaleService`'s existing fallback (from Phase 22) is what gets returned — this prompt should not change that fallback text logic, only ensure the retry wrapper correctly falls through to it.

**Constraints:** Do not change business logic, only error-handling/resilience wrapping around existing calls.

**Acceptance Criteria:**
- [ ] Simulating a Gemini 429/failure results in the documented fallback rationale text being used, with at most 2 retries attempted first (observable in logs).
- [ ] A malformed request to any P1 endpoint returns a consistent `{ error: {...} }` shape with an appropriate status code, never a raw stack trace.
- [ ] A Tesseract OCR failure (e.g., corrupt file) returns a clear typed error instead of crashing the process.

**Testing Requirements:** Simulate each failure mode (bad Gemini key, malformed request body, corrupt OCR upload) and confirm graceful, well-shaped error responses.

**Completion Report:** Confirm all three failure modes are handled gracefully, confirm consistent error response shape across the API.

---

### P24.2 — PR2 Backend Error Handling + AI/OCR Fallbacks
**Phase:** 24 — Error handling and fallbacks
**Type:** [PARALLEL]
**Dependencies:** P4.2, P12.1, P16.1, P17.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Harden the PR2 backend's exception handling beyond the Phase 4 skeleton, mirroring P24.1's approach for Gemini/OCR-adjacent failure paths.

**CREATE:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/ai/RateLimitAwareRetry.java` (generic retry-with-backoff utility for `GeminiClient` calls, max 2 retries)

**MODIFY:**
- `/pr2-backend/src/main/java/com/chainvision/pr2/config/GlobalExceptionHandler.java` (expand from the Phase 4 skeleton: map validation errors to 400, not-found to 404, upstream AI/OCR failures to 502 with a clear message, unexpected errors to 500 with a safe generic message)
- `/pr2-backend/src/main/java/com/chainvision/pr2/ai/GeminiClient.java` (wrap calls with `RateLimitAwareRetry`)
- `/pr2-backend/src/main/java/com/chainvision/pr2/requisition/IntentExtractionService.java` (confirm its existing low-confidence fallback from Phase 12 is what's returned after retries are exhausted — no change to the fallback content itself)
- `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/InvoiceStructuringService.java` (same — confirm its existing manual-review fallback from Phase 16 is preserved after retries are exhausted)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/pr2-backend/src/main/java/com/chainvision/pr2/invoice/OcrClient.java` (add basic try/catch around its HTTP call to P1's OCR endpoint if not already present from Phase 16 — read first to check, only add if missing, don't restructure)

**Implementation Instructions:**
1. Mirror P24.1's pattern in Java: `GlobalExceptionHandler` should produce a consistent JSON error shape (`{ "error": { "code": ..., "message": ... } }`) across the whole PR2 API.
2. `RateLimitAwareRetry.java`: generic retry-with-jitter wrapper, max 2 retries, usable anywhere `GeminiClient` is called.
3. If `OcrClient.java` doesn't already handle a P1-backend-unreachable scenario gracefully (e.g., P1 is down), add a try/catch that surfaces a clear 502-style error rather than an unhandled exception, so invoice upload doesn't crash the PR2 process.

**Constraints:** Do not change business logic — resilience wrapping only.

**Acceptance Criteria:**
- [ ] Simulated Gemini failures fall through to the existing Phase 12/16 fallback behaviors after at most 2 retries.
- [ ] Simulated P1-OCR-endpoint-unreachable scenario returns a clear error from invoice upload instead of a 500/crash.
- [ ] All PR2 endpoints return a consistent error JSON shape on failure.

**Testing Requirements:** Simulate each failure mode (bad Gemini key, P1 backend stopped, malformed request) and confirm graceful responses.

**Completion Report:** Confirm all three failure modes handled gracefully, confirm consistent error shape across the PR2 API.

---

### P24.3 — Frontend Error Boundaries and Toast Notifications
**Phase:** 24 — Error handling and fallbacks
**Type:** [PARALLEL]
**Dependencies:** P9.2, P19.2, P19.3

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Add error boundaries and a consistent toast/notification system across both dashboards so backend failures (including the AI/OCR fallback scenarios from P24.1/P24.2) are surfaced clearly to the user during a live demo instead of silently failing.

**CREATE:**
- `/frontend/src/components/ErrorBoundary.tsx` (React error boundary wrapping each dashboard layout)
- `/frontend/src/components/Toast.tsx` + `/frontend/src/hooks/useToast.ts` (simple global toast notification system — success/error/info variants)
- `/frontend/src/api/apiInterceptor.ts` (axios response interceptor shared by both `p1Client.ts` and `pr2Client.ts`: on error responses matching the `{ error: { code, message } }` shape from P24.1/P24.2, triggers a toast automatically)

**MODIFY:**
- `/frontend/src/App.tsx` (wrap `/planner` and `/procurement` route trees in `ErrorBoundary`, mount a global `Toast` container)
- `/frontend/src/api/p1Client.ts`, `/frontend/src/api/pr2Client.ts` (attach `apiInterceptor` — small, additive change to each file's axios instance setup only)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, all page components under `/frontend/src/pages/**` (do not touch — this prompt's toast system is designed to work automatically via the interceptor, without requiring every page component to be individually modified)

**Implementation Instructions:**
1. `ErrorBoundary.tsx`: standard React class-based error boundary, shows a friendly "Something went wrong — try refreshing" message instead of a blank white screen on an uncaught render error.
2. `useToast.ts`: simple global state (context or a tiny external store) other components/interceptors can push `{ type, message }` into; `Toast.tsx` renders the active queue.
3. `apiInterceptor.ts`: registered once on each axios instance; catches error responses, extracts `error.message` if present (per the shape from P24.1/P24.2), and calls `useToast`'s push function — this means individual page components don't need manual try/catch toast calls for the common case.

**Constraints:** Do not add per-page try/catch/toast calls to existing page files — the interceptor should handle the common case automatically, keeping this prompt's footprint small.

**Acceptance Criteria:**
- [ ] A simulated backend 500/502 error anywhere in the app produces a visible toast instead of a silent failure.
- [ ] A forced React render error inside a dashboard shows the error boundary's friendly message instead of a blank screen.

**Testing Requirements:** Temporarily stop the PR2 backend and trigger a PR2 API call from the frontend — confirm a toast appears; temporarily throw an error inside a test component to confirm the error boundary catches it.

**Completion Report:** Confirm toast-on-API-error works across both dashboards, confirm error boundary catches render errors, confirm no per-page files were modified.

---

# PHASE 25 — Testing

### P25.1 — P1 Deterministic Engine Unit Test Suite Review & Gap-Fill
**Phase:** 25 — Testing
**Type:** [PARALLEL]
**Dependencies:** P5.1, P6.1, P7.1, P7.2

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Consolidate and extend the unit tests already written incrementally in Phases 5–7, ensuring every deterministic P1 engine has thorough, documented coverage — this suite is the project's core defensibility for the "Technical Implementation" and "Model Performance" judging criteria (Section 4 hackathon deck).

**CREATE:**
- `/p1-backend/tests/engines.coverage.md` (a short written summary of what's covered, what edge cases were tested, and current coverage % if a coverage tool is configured)

**MODIFY:**
- `/p1-backend/src/engine/demandEngine.test.ts`, `/p1-backend/src/engine/expiryRiskEngine.test.ts`, `/p1-backend/src/engine/fefoEngine.test.ts`, `/p1-backend/src/engine/replenishmentMathEngine.test.ts` (add any missing edge cases identified during review — zero-demand, negative/invalid input guarding, boundary expiry dates, single-batch FEFO, etc. — additive test cases only, do not remove or weaken existing tests)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, all files under `/p1-backend/src/engine/*.ts` (test-only prompt — do not modify engine implementation logic itself; if a real bug is found, report it in the completion report rather than silently patching engine logic outside this prompt's scope)

**Implementation Instructions:**
1. Review each existing test file for gaps against the formulas/thresholds documented in Phases 5–7's code comments.
2. Add edge cases: zero/negative inputs, extremely large quantities, ties in FEFO ordering, exact-boundary expiry-risk thresholds (e.g., exactly 30 days).
3. Write `engines.coverage.md` summarizing test counts per engine and any known gaps intentionally left for time reasons.

**Constraints:** This is a test-only prompt — no engine implementation changes. If a bug is found, document it clearly for the coordinator instead of fixing it here.

**Acceptance Criteria:**
- [ ] Each of the four engine test files has at least 6 test cases covering normal + edge conditions.
- [ ] All tests pass.
- [ ] `engines.coverage.md` accurately summarizes coverage.

**Testing Requirements:** Run the full P1 test suite; confirm 100% pass rate.

**Completion Report:** Report total test count per engine, confirm pass rate, list any engine bugs discovered (without fixing them) for the coordinator to triage.

---

### P25.2 — PR2 Unit Test Suite Review & Gap-Fill
**Phase:** 25 — Testing
**Type:** [PARALLEL]
**Dependencies:** P10.1, P17.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Consolidate and extend unit tests for `SupplierScoringEngine` and `ThreeWayMatchEngine` — the two core deterministic Java engines — mirroring P25.1's approach on the PR2 side.

**CREATE:**
- `/pr2-backend/src/test/java/com/chainvision/pr2/TEST_COVERAGE.md`

**MODIFY:**
- `/pr2-backend/src/test/java/com/chainvision/pr2/sourcing/SupplierScoringEngineTest.java`, `/pr2-backend/src/test/java/com/chainvision/pr2/invoice/ThreeWayMatchEngineTest.java` (add missing edge cases — additive only)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `SupplierScoringEngine.java`, `ThreeWayMatchEngine.java` (test-only prompt, do not modify implementation)

**Implementation Instructions:**
1. `SupplierScoringEngineTest`: add cases for a supplier below required capacity (should be excluded/penalized), a tie-breaking scenario, and an all-suppliers-equal scenario.
2. `ThreeWayMatchEngineTest`: add cases at the exact tolerance boundary (e.g., exactly 2% off), a completely missing GRN, and a zero-quantity edge case.
3. Write `TEST_COVERAGE.md` summarizing coverage and any known gaps.

**Constraints:** Test-only prompt — report bugs, don't fix engine code here.

**Acceptance Criteria:**
- [ ] Both test classes have at least 6 cases each covering normal + edge conditions.
- [ ] All tests pass via `mvn test`.

**Testing Requirements:** Run `mvn test`; confirm 100% pass rate for these two classes.

**Completion Report:** Report test counts, confirm pass rate, list any discovered bugs for triage.

---

### P25.3 — End-to-End Smoke Test Script (Full Demo Flow)
**Phase:** 25 — Testing
**Type:** [SEQUENTIAL] (blocks Phase 26)
**Dependencies:** P20.1, P21.1, P22.1, P18.1, P19.3

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Write a single automated smoke-test script that walks the entire Section 16 demo flow end-to-end against the live, running system — this is the project's ultimate integration check before Phase 26.

**CREATE:**
- `/scripts/e2e_smoke_test.ts` (Node script, not a UI test — hits the real P1 and PR2 REST APIs directly in sequence, matching Section 16's 10 steps, asserting expected state after each step)
- `/scripts/README_smoke_test.md` (how to run it, what environment it expects — live P1/PR2/Supabase, seeded data present)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, all backend route/controller files (read-only reference for exact request/response shapes — do not modify any of them)

**Implementation Instructions:**
1. Script steps, matching Section 16: (1) confirm inventory/alerts data exists, (2) trigger a demand spike + recalculate, assert a new recommendation is created, (3) assert a corresponding requisition now exists in PR2 (handoff worked), (4) call the intent-extraction endpoint with the demo sentence and assert a sane structured guess, (5) generate a PO from a requisition and assert supplier/pricing populated, (6) simulate goods receipt, (7) upload the "matching" sample invoice and assert structured extraction, (8) run 3-way match and assert MATCHED + auto-approved payment, (9) upload a mismatch sample and assert it lands in the exception queue with an `ai_explanation`, (10) fetch the analytics summary (or client-computed equivalent) and assert it reflects the processed invoices.
2. Each step should print a clear pass/fail line; the script should exit non-zero if any step fails, so it can gate later phases if desired.

**Constraints:** This script only calls existing APIs — it must not modify any application source files.

**Acceptance Criteria:**
- [ ] Running the script against a freshly-seeded, fully-deployed system prints all 10 steps as PASS.
- [ ] The script exits non-zero and clearly identifies the failing step if something is broken.

**Testing Requirements:** Run the script twice in a row against the live system (idempotency isn't strictly required, but the second run shouldn't crash the script itself, just potentially show different data).

**Completion Report:** Paste the full pass/fail output from a live run, and flag this as the primary tool Phase 26 should use to validate integration.

---

# PHASE 26 — Integration

### P26.1 — Integration Bug Bash and Fix Coordination
**Phase:** 26 — Integration
**Type:** [SEQUENTIAL] (blocks Phase 27)
**Dependencies:** P25.3

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Run the full system end-to-end using the Phase 25.3 smoke test plus a manual UI walkthrough of Section 16, catalog every gap found, and either fix small, clearly-scoped issues directly or produce a triaged list for the original file-owning prompt to address.

**CREATE:**
- `/INTEGRATION_BUG_BASH.md` (dated log: what was tested, what passed, what failed, severity, owner/file, fix status)

**MODIFY:** Only files where a **small, obviously-scoped, low-risk fix** is needed (e.g., a typo'd field name, a missing null-check) — any non-trivial fix must be logged in `INTEGRATION_BUG_BASH.md` and handed back to the original prompt's file owner rather than fixed ad hoc here, to preserve file-ownership boundaries established across Phases 1–24.

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/scripts/e2e_smoke_test.ts` (run it, don't modify it here — if the test itself is wrong, log that too rather than silently changing it)

**Implementation Instructions:**
1. Run `/scripts/e2e_smoke_test.ts` against the live deployed system; log the result.
2. Manually walk through Section 16's 10 demo steps in an actual browser session (both dashboards), logging any UX or functional gap not caught by the API-level smoke test.
3. Classify each finding as Critical (blocks the demo), Major (visible but workaroundable), or Minor (cosmetic).
4. Fix only Minor/trivially-scoped issues directly, in the narrowest possible diff, staying inside the original owning file. Everything else goes into the log with a clear "who should fix this" pointer (reference the original Phase/Prompt ID that owns the affected file).

**Constraints:** Do not perform large refactors under this prompt. Preserve every other prompt's file-ownership boundary — this is a triage and light-touch-fix pass, not a rewrite pass.

**Acceptance Criteria:**
- [ ] `INTEGRATION_BUG_BASH.md` documents the full smoke test result plus the manual walkthrough findings.
- [ ] Every Critical finding has either been fixed (if trivial) or has a named owner and file for follow-up.
- [ ] The smoke test is re-run after any fixes made in this prompt and its new result is logged.

**Testing Requirements:** Full smoke test run before and after any fixes made in this prompt.

**Completion Report:** Summarize Critical/Major/Minor counts, confirm final smoke test pass rate, list any Critical items still needing another prompt's owner to resolve before Phase 27.

---

# PHASE 27 — Deployment

### P27.1 — Docker Compose Finalization + Local Run README
**Phase:** 27 — Deployment
**Type:** [SEQUENTIAL]
**Dependencies:** P26.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Finalize `docker-compose.yml` so the entire system (frontend + p1-backend + pr2-backend, all pointed at the shared Supabase project) comes up with a single command, and document exactly how to run it, per Section 17's Definition of Done.

**CREATE:**
- `/README.md` (replace the P1.1 placeholder with a real quick-start guide: prerequisites, env setup, `docker compose up`, seed script instructions, demo account credentials, link to `00_PROJECT_CONTEXT.md` and `INTEGRATION_BUG_BASH.md`)

**MODIFY:**
- `/docker-compose.yml` (finalize all three service definitions: correct build contexts, ports, `env_file`, `depends_on` ordering if relevant, healthchecks)
- `/.env.example` (final pass — confirm every variable referenced anywhere in the codebase is present with a placeholder and a one-line comment)

**READ ONLY:** `00_PROJECT_CONTEXT.md`, all application source files (this prompt is packaging/documentation only, not code changes)

**Implementation Instructions:**
1. Confirm all three services build and start correctly together via `docker compose up`.
2. `README.md` should be short and skimmable: prerequisites (Node, Java 17, Docker, a Supabase project + keys, a free Gemini API key), setup steps (clone, copy `.env.example` to `.env` and fill in real values, run seed scripts, `docker compose up`), and the three demo account credentials.
3. Do a final audit of `.env.example` against every `process.env.*` / `@Value` reference across both backends and the frontend's `import.meta.env.*` usage, to make sure nothing is missing.

**Constraints:** Documentation and Docker config only — no application source changes.

**Acceptance Criteria:**
- [ ] `docker compose up` brings up all three services successfully on a clean checkout with a correctly filled `.env`.
- [ ] README is accurate and can be followed by someone unfamiliar with the project.
- [ ] `.env.example` is complete (audited against actual code usage) and contains no real secrets.

**Testing Requirements:** Fresh clone + `docker compose up` dry run; follow the README steps literally as written.

**Completion Report:** Confirm clean `docker compose up` success, confirm README completeness, confirm `.env.example` audit result.

---

### P27.2 — Optional Public Deployment (Render/Railway)
**Phase:** 27 — Deployment
**Type:** [PARALLEL] (nice-to-have, does not block Phase 28)
**Dependencies:** P27.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Optionally deploy CHAINVISION to a public URL (Render or Railway, per Section 5.9) so judges can browse it before the in-person demo, satisfying the "Deployment and Integration" evaluation criterion from the hackathon deck.

**CREATE:**
- `/infra/render.yaml` or `/infra/railway.json` (deployment config for the chosen platform, defining the three services and their env var references — no secret values)
- `/DEPLOYMENT.md` (steps taken, the public URL once live, and any platform-specific gotchas encountered)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/docker-compose.yml`, `/.env.example`

**Implementation Instructions:**
1. Pick one platform (Render or Railway) based on whichever more directly supports the existing Dockerfiles with least friction.
2. Configure three services matching the Docker Compose setup, pointing env vars at the platform's secret-management UI (documented, not committed).
3. Deploy and confirm the public URL loads the frontend and both backends respond to `/health`.

**Constraints:** This prompt is explicitly optional/best-effort given the 5-day timeline — if platform friction consumes too much time, stop, document the blocker in `DEPLOYMENT.md`, and defer to the in-person demo (which does not require this).

**Acceptance Criteria:**
- [ ] Either a working public URL is documented, or a clear blocker explanation is left in `DEPLOYMENT.md` for the coordinator's awareness.

**Testing Requirements:** If deployed, run `/scripts/e2e_smoke_test.ts` against the public URLs to confirm parity with local.

**Completion Report:** State the outcome (deployed + URL, or blocked + reason), confirm smoke test result against the public deployment if applicable.

---

# PHASE 28 — Final Demo Preparation

### P28.1 — Seed Reset Script + Demo Rehearsal Script
**Phase:** 28 — Final demo preparation
**Type:** [SEQUENTIAL]
**Dependencies:** P26.1, P27.1

**Objective:** Read 00_PROJECT_CONTEXT.md before starting. Produce a one-command "reset to demo-ready state" script and a step-by-step rehearsal script the human presenter will literally read from during judging, mirroring Section 16 exactly.

**CREATE:**
- `/scripts/reset_demo_data.ts` (truncates and re-runs P3.1/P3.2's seed scripts against the live Supabase project, restoring a clean, demo-ready starting state — including deleting any recommendations/requisitions/POs/invoices created during rehearsal runs)
- `/DEMO_SCRIPT.md` (a literal, step-by-step narration script mirroring Section 16's 10 steps, with exact UI actions, what to say, and what to point at on screen for each step)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/shared/seed-data/**`

**Implementation Instructions:**
1. `reset_demo_data.ts` should be safe to run repeatedly between rehearsal runs — truncate P1/PR2 transactional tables (recommendations, requisitions, POs, GRNs, invoices, matches, payment approvals) while preserving master data (SKUs, DCs, suppliers), then re-run the seed inserts for anything that needs to exist at demo start.
2. `DEMO_SCRIPT.md` should read like presenter notes: "Step 1: Log in as planner@demo.com. Say: '...' Point at: the expiry heatmap, note the two CRITICAL cells." — one entry per Section 16 step, plus a short intro/outro.
3. Include a "if something breaks" contingency note per step (e.g., "if realtime doesn't update within 5 seconds, hit refresh — don't panic on stage").

**Constraints:** Scripting/documentation only.

**Acceptance Criteria:**
- [ ] Running `reset_demo_data.ts` after a full rehearsal run restores the system to a state indistinguishable from a fresh seed.
- [ ] `DEMO_SCRIPT.md` covers all 10 Section 16 steps with concrete narration and screen-pointer notes.

**Testing Requirements:** Do a full live rehearsal run of all 10 steps, then run the reset script, then confirm the system looks freshly seeded again.

**Completion Report:** Confirm reset script works cleanly after a rehearsal, confirm `DEMO_SCRIPT.md` is presenter-ready.

---

### P28.2 — Presentation Deck / Video Content Outline
**Phase:** 28 — Final demo preparation
**Type:** [PARALLEL]
**Dependencies:** P28.1

**Objective:** Prepare the written content outline for the hackathon's required submission format (PPT or video over email, per the hackathon deck's "Expectation from Participants" slide), covering the judged criteria from the deck (Use Case Understanding, Solution Architecture, Innovation, UI/UX, Technical Implementation, Model Performance, Deployment, Presentation, Collaboration).

**CREATE:**
- `/PRESENTATION_OUTLINE.md` (slide-by-slide or scene-by-scene outline: title/team, problem statement recap for P1+PR2, architecture diagram description referencing Section 6, the deterministic-vs-AI design principle as a differentiator, live demo hand-off point matching `DEMO_SCRIPT.md`, results/metrics to show from the analytics view, lessons learned, close)

**MODIFY:** None

**READ ONLY:** `00_PROJECT_CONTEXT.md`, `/DEMO_SCRIPT.md`

**Implementation Instructions:**
1. Structure the outline to explicitly hit every bullet from the hackathon deck's "Factors To Consider When You Build the Solution" and "Evaluation Criteria" slides, so nothing scored is left unaddressed in the actual presentation.
2. Explicitly call out the P1→PR2 integration (Section 4) as the core differentiator versus teams that built the two use cases separately.
3. Explicitly call out the deterministic-core / AI-at-the-edges design principle (Section 5.1) as a technical-quality talking point — judges evaluating "Model Performance and Evaluation" and "Technical Implementation" will want to see this articulated clearly.
4. Reserve one section for the live demo hand-off, referencing `DEMO_SCRIPT.md` rather than duplicating it.

**Constraints:** Outline only — do not build the actual PPT/video file in this prompt (out of scope for a Claude coding session; hand to the human presenter).

**Acceptance Criteria:**
- [ ] Every judged criterion from the hackathon deck's evaluation slides is addressed by at least one outlined section.
- [ ] The outline explicitly references both the P1→PR2 integration and the deterministic/AI split as differentiators.

**Testing Requirements:** N/A (documentation deliverable) — read through once against the hackathon deck's evaluation criteria list to self-check completeness.

**Completion Report:** Confirm every evaluation criterion is covered, confirm the outline is ready to hand to whoever builds the final PPT/video.

---

*End of PROMPTS.md — 45 prompts across 28 phases. No application source code was written in producing this file, per instructions.*
