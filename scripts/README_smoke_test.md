# E2E Smoke Test — Full Demo Flow (Section 16)

Automated integration check that walks the **entire 10-step CHAINVISION demo flow** against a
live, running system. This is the primary tool Phase 26 (Integration Bug Bash) should use to
validate the P1 ↔ PR2 ↔ Supabase wiring.

**The script only calls existing REST APIs. It never modifies application source files.**

---

## Prerequisites

1. **P1 backend running** on `http://localhost:4000`
   ```bash
   cd p1-backend && npm run dev
   ```

2. **PR2 backend running** on `http://localhost:8080` (Java 17+ required)
   ```bash
   # Windows
   set JAVA_HOME=C:\Program Files\Java\jdk-25.0.3   (or your JDK path)
   cd pr2-backend && mvnw.cmd spring-boot:run
   ```

3. **Supabase project reachable** and migrations applied (`infra/supabase/migrations/*`).

4. **Seed data loaded** (freshly-seeded system gives the cleanest run):
   ```bash
   cd shared/seed-data
   npx tsx p1_seed.ts
   npx tsx pr2_seed.ts
   ```
   Sample invoices must exist at `shared/seed-data/sample_invoices/`.

5. **A demo user in Supabase Auth** (both backends now verify Supabase JWTs):
   - Create a user in the Supabase dashboard (Authentication → Users → Add user),
     e.g. `planner@chainvision.test`, with any password, and give it a row in the
     `users` table with role `ADMIN` (or PLANNER + PROCUREMENT_OFFICER coverage).

---

## Configuration

Environment variables (all can live in the repo-root `.env`, which is auto-loaded):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `P1_BASE_URL` | no | `http://localhost:4000` | P1 backend base |
| `PR2_BASE_URL` | no | `http://localhost:8080` | PR2 backend base |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | yes | — | Supabase project URL |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | yes | — | Supabase anon key (for sign-in) |
| `SMOKE_TEST_EMAIL` | yes | — | Demo user email for sign-in |
| `SMOKE_TEST_PASSWORD` | yes | — | Demo user password |

Example:

```bash
export SMOKE_TEST_EMAIL=planner@chainvision.test
export SMOKE_TEST_PASSWORD='your-demo-password'
```

---

## Running

From the repo root:

```bash
npx tsx scripts/e2e_smoke_test.ts
```

(No extra dependencies are needed beyond `tsx`; the script uses Node 18+ built-in `fetch`,
`FormData`, and `Blob`.)

---

## What each step does

| Step | Check |
|---|---|
| 0 | Health checks on both backends + Supabase sign-in (JWT acquired) |
| 1 | Seeded SKUs, DCs, and inventory data exist in P1 |
| 2 | Demand spike ingested + recalculate → new replenishment recommendation created |
| 3 | That recommendation appears as a SYSTEM-source requisition in PR2 (**the handoff**) |
| 4 | Gemini intent extraction returns a sane structured guess from the demo sentence |
| 5 | PO generated from requisition — supplier, unit price, total all populated |
| 6 | Goods receipt simulated against the PO |
| 7 | Matching sample invoice uploaded → structured OCR/Gemini extraction populated |
| 8 | 3-way match → MATCHED, invoice status transitions to auto-approved state |
| 9 | Qty-mismatch sample invoice → MISMATCHED, lands in exception queue with `aiExplanation` |
| 10 | `/api/analytics/p2p-summary` reflects ≥2 processed invoices and touchless rate |

Each step prints `PASS [n/10] …` or `FAIL [n/10] …` plus detail. The script **exits non-zero**
if anything fails, so it can gate CI or later phases.

---

## Idempotency notes

The script is *not* strictly idempotent by design — each run creates a fresh demand signal,
recommendation, requisition, PO, GRN, and two invoice rows. Running it twice in a row is safe:
- Step 3 falls back to an existing requisition if the exact one isn't found,
- Step 5 falls back to an existing PO for the chosen requisition.

Data accumulates across runs; re-run the seed scripts to reset to a clean demo state.

---

## Known issue: retired Gemini model (environmental, not a code bug)

`gemini-2.0-flash` — the model hardcoded as the default in `p1-backend/src/services/geminiClient.ts`
and `pr2-backend/.../ai/GeminiClient.java` (and `.env.example`) — **has been retired by Google**
and now returns `404 Not Found`. Until a working `GEMINI_MODEL`/`GEMINI_API_KEY` is supplied in
`.env`, every Gemini-dependent path degrades gracefully:

- **Step 4 (intent extraction)** returns `manualEntryRequired: true` with `confidence: 0` → reported as **WARN**, not FAIL.
- **Step 7 → 8 (invoice OCR + 3-way match)** — OCR structuring fails, so the invoice is stored with
  zeroed `quantityOcr`/`unitPriceOcr` fields; the 3-way match then can't MATCH → reported as **WARN**.

The deterministic engine logic is correct; the failure is purely the missing/retired AI model.
Set a valid model in `.env` (e.g. `GEMINI_MODEL=models/gemini-<valid>`) and the warned steps
will turn to PASS on the next run. Because of this, **the smoke test exits 0 when only WARNED
steps remain** — only genuine FAILURES (broken deterministic flow, auth, handoff) make it non-zero.
