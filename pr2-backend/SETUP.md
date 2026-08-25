# PR2 Backend — Setup Guide

Everything needed to get the PR2 (Procure-to-Pay) Spring Boot backend running
on a fresh machine, from a clean `git clone` to running the full P2P flow —
requisition → supplier selection → PO → goods receipt → invoice/OCR →
3-way match → payment approval/exception — against a real Postgres database.

This file is scoped to `pr2-backend/` only. For the overall CHAINVISION
architecture, read `../Documentaion/00_PROJECT_CONTEXT.md` first — it is the
project's single source of truth — and then `../Documentaion/PROMPTS.md`,
whose "ARCHITECTURE NOTE" section near the top **supersedes** the DB/Auth/
Realtime parts of `00_PROJECT_CONTEXT.md` (Supabase instead of self-hosted
Postgres + custom JWT + Socket.IO). Read the Architecture Note before trusting
anything about DB/Auth/Realtime in the main context doc.

---

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| git | any recent | clone the repo |
| Docker + Docker Compose | any recent | local Postgres for dev, and later the full `docker compose up` stack |
| JDK | 17 | required by `pom.xml` / Spring Boot 3.3.x |

You do **not** need Maven installed system-wide — this project uses the
Maven Wrapper (`mvnw` / `mvnw.cmd`), committed to the repo, which downloads
the correct Maven version automatically the first time you run it.

### Getting JDK 17

Recommended: [SDKMAN](https://sdkman.io/) — installs into your home
directory, no root/sudo required, works the same on any Linux/Mac machine:

```bash
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java 17.0.19-tem
```

(On Windows, use an installer from [Adoptium](https://adoptium.net/) instead,
or WSL + the commands above.)

Verify:

```bash
java -version   # should print 17.x
```

If you use a different JDK vendor/version manager, any JDK 17 works —
SDKMAN is just the easiest to reproduce identically on a new machine.

---

## 2. Clone

```bash
git clone https://github.com/arpan-20/CHAINVISION.git
cd CHAINVISION/pr2-backend
```

> **Repo quirks worth knowing** (as of the "p1 added" commit): the backend
> folder used to be named `p2-backend` (mismatched with `docker-compose.yml`,
> which builds a `pr2-backend` context, and with the Maven artifact/package
> name `com.chainvision.pr2`) — this has been renamed to `pr2-backend` to
> match. There's also an `infra/postgress/` folder (double "s", empty/unused)
> at the repo root — not to be confused with this backend's own
> `pr2-backend/local-dev/init-db.sql`, which is unrelated and dev-only.

---

## 3. Local development database

The real deployment uses a **Supabase-hosted** Postgres project (see the
Architecture Note referenced above) — there's deliberately no `postgres`
service in the root `docker-compose.yml`. But you don't need Supabase
credentials to develop locally: `pr2-backend/local-dev/` has a throwaway
Postgres you can point the app at instead.

```bash
docker compose -f local-dev/docker-compose.yml up -d
```

This starts a Postgres 16 container on `localhost:5433` (not 5432, so it
won't collide with any Postgres you already have running), creates the full
`pr2` schema — `suppliers`, `purchase_requisitions`, `purchase_orders`,
`goods_receipts`, `invoices`, `three_way_matches`, `payment_approvals`
(mirroring `00_PROJECT_CONTEXT.md` Section 7.2) — and seeds 3 sample
suppliers.

Check it's ready:

```bash
docker exec pr2-local-postgres pg_isready -U pr2dev -d pr2dev
```

`application.yml`'s defaults already point at this local container
(`localhost:5433`, db/user/password `pr2dev`), so **no `.env` file is
required** just to run locally — it works out of the box.

To reset the local DB to a clean seeded state:

```bash
docker compose -f local-dev/docker-compose.yml down -v
docker compose -f local-dev/docker-compose.yml up -d
```

---

## 4. Build and run

```bash
./mvnw clean package -DskipTests   # first run downloads Maven + dependencies, can take a few minutes
java -jar target/pr2-backend.jar
```

Or, for a faster dev loop (recompiles without repackaging a jar each time):

```bash
./mvnw spring-boot:run
```

The app starts on `http://localhost:8080` (override with the `PR2_PORT` env
var). Confirm the Hikari connection pool started without errors in the
startup logs — that means it connected to Postgres successfully.

---

## 5. Verify it works — the full demo flow end to end

```bash
BASE=http://localhost:8080

curl $BASE/health
# {"status":"ok"}

# 1. Create a requisition
REQ=$(curl -s -X POST $BASE/api/requisitions -H "Content-Type: application/json" \
  -d '{"skuCode":"PARACETAMOL-500","dcCode":"KOL-DC1","quantity":500,"urgency":"HIGH"}')
REQ_ID=$(echo "$REQ" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 2. Preview deterministic supplier scoring (optional — PO creation runs this internally too)
curl -s -X POST $BASE/api/suppliers/select/$REQ_ID

# 3. Raise a PO (runs supplier selection for real, computes unit price, moves the requisition to PO_RAISED)
PO=$(curl -s -X POST $BASE/api/purchase-orders/$REQ_ID)
PO_ID=$(echo "$PO" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
PO_UNIT_PRICE=$(echo "$PO" | python3 -c "import sys,json; print(json.load(sys.stdin)['unitPrice'])")

# 4. Record goods receipt (full quantity -> PO becomes RECEIVED)
curl -s -X POST $BASE/api/goods-receipts -H "Content-Type: application/json" \
  -d "{\"poId\":\"$PO_ID\",\"receivedQty\":500,\"batchNo\":\"B100\",\"expiryDate\":\"2027-06-01\"}"

# 5. Upload an invoice. Without GEMINI_API_KEY set, OCR is skipped and the manual* fields are
#    used directly instead — see §8 for enabling real OCR.
INV=$(curl -s -X POST $BASE/api/invoices/upload \
  -F "file=@/path/to/any/pdf/or/image" \
  -F "poId=$PO_ID" -F "manualInvoiceNumber=INV-1001" \
  -F "manualQuantity=500" -F "manualUnitPrice=$PO_UNIT_PRICE")
INV_ID=$(echo "$INV" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 6. Run the deterministic 3-way match — matches here, so payment auto-approves immediately
curl -s -X POST $BASE/api/invoices/$INV_ID/match
curl -s $BASE/api/invoices/$INV_ID   # status: APPROVED

# 7. See it on the dashboard summary
curl -s $BASE/api/analytics/p2p-summary
```

To see the mismatch/exception path instead, upload with a `manualQuantity`
that differs from the received quantity by more than the tolerance (default
2%, see §8) — the invoice ends up in `EXCEPTION` status, shows up in
`GET /api/exceptions`, and `POST /api/exceptions/{id}/resolve` (body
`{"action":"APPROVE"|"REJECT","resolvedBy":"..."}`) closes it out.

Or import `pr2-backend/postman/CHAINVISION-PR2.postman_collection.json`
(see §7) into Postman — it has every endpoint below, organized by domain,
with collection variables (`requisitionId`, `poId`, `invoiceId`) to carry
IDs between requests.

### Full API surface

Matches `Documentaion/00_PROJECT_CONTEXT.md` Section 13.2 exactly.

| Area | Endpoint | Notes |
|---|---|---|
| Requisitions | `POST /api/requisitions` | manual/chatbot-derived creation |
| Requisitions | `POST /api/requisitions/from-recommendation` | the P1 → PR2 handoff |
| Requisitions | `POST /api/requisitions/parse-intent` | Gemini NL intent extraction (needs `GEMINI_API_KEY`) |
| Requisitions | `GET /api/requisitions`, `GET /api/requisitions/{id}` | |
| Suppliers | `GET /api/suppliers` | |
| Suppliers | `POST /api/suppliers/select/{requisitionId}` | read-only scoring preview, no side effects |
| Purchase Orders | `POST /api/purchase-orders/{requisitionId}` | no body; runs supplier selection and computes unit price |
| Purchase Orders | `GET /api/purchase-orders`, `GET /api/purchase-orders/{id}` | |
| Goods Receipts | `POST /api/goods-receipts` | body `{"poId","receivedQty","batchNo","expiryDate"}` |
| Goods Receipts | `GET /api/goods-receipts?poId=...` | `poId` optional |
| Invoices | `POST /api/invoices/upload` | multipart; `file` + optional `poId` + `manualInvoiceNumber`/`manualVendorName`/`manualQuantity`/`manualUnitPrice` |
| Invoices | `GET /api/invoices`, `GET /api/invoices/{id}` | |
| Invoices | `POST /api/invoices/{id}/match` | deterministic 3-way match; auto-approves payment on MATCHED |
| Exceptions | `GET /api/exceptions` | invoices in EXCEPTION with no resolution yet |
| Exceptions | `POST /api/exceptions/{id}/resolve` | body `{"action":"APPROVE"|"REJECT","resolvedBy"}` |
| Analytics | `GET /api/analytics/p2p-summary` | touchless %, exception %, avg cycle time, in-flight counts |

---

## 6. Running via Docker instead (no local JDK needed at all)

If you'd rather not install a JDK on a given machine, the repo's own
`pr2-backend/Dockerfile` does a full multi-stage Maven build inside a
container:

```bash
docker build -t pr2-backend .
docker run --rm -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/pr2dev \
  -e SPRING_DATASOURCE_USERNAME=pr2dev \
  -e SPRING_DATASOURCE_PASSWORD=pr2dev \
  pr2-backend
```

(`host.docker.internal` lets the container reach the `local-dev` Postgres
container running on the host; on Linux you may need
`--add-host=host.docker.internal:host-gateway` for that to resolve, or run
both containers on the same Docker network instead.)

---

## 7. Testing with Postman

Import `pr2-backend/postman/CHAINVISION-PR2.postman_collection.json` — it
covers every endpoint in §5's API table, grouped by domain (Requisitions,
Suppliers, Purchase Orders, Goods Receipts, Invoices, Exceptions, Analytics),
using collection variables (`requisitionId`, `poId`, `invoiceId`) so you can
paste an ID from one response into the next request. Keep it updated in this
file as the API evolves so any machine can re-import the same up-to-date
collection instead of rebuilding requests from scratch.

---

## 8. Switching to the real Supabase project

Once you have Supabase project credentials from the team (Account 2 owns
`/infra/supabase/migrations/**` per `Documentaion/PROMPTS.md`), point the app
at it instead of the local container purely via environment variables — no
code changes:

```bash
export SPRING_DATASOURCE_URL="jdbc:postgresql://<project-ref>.supabase.co:5432/postgres?currentSchema=pr2"
export SPRING_DATASOURCE_USERNAME="postgres"
export SPRING_DATASOURCE_PASSWORD="<supabase-db-password>"
./mvnw spring-boot:run
```

Or put those in a root `.env` (copy from `.env.example`) if running via the
root `docker-compose.yml`.

---

## 8b. Enabling real AI features (Gemini)

Three endpoints call Google Gemini (Documentaion/00_PROJECT_CONTEXT.md
Section 5.7/9): `POST /api/requisitions/parse-intent`, invoice OCR inside
`POST /api/invoices/upload`, and mismatch explanation text inside
`POST /api/invoices/{id}/match`. None of them are required for the
deterministic P2P flow to work — without a key, parse-intent returns a clear
`503`, OCR falls back to whatever `manual*` fields you pass, and mismatch
explanations fall back to the deterministic reason string.

To enable them, get a free key from
[Google AI Studio](https://aistudio.google.com/apikey) and set:

```bash
export GEMINI_API_KEY="your-key"
export GEMINI_MODEL="gemini-2.0-flash"   # default if unset
./mvnw spring-boot:run
```

Other tunable behavior (all optional, all have sane defaults — see
`application.yml`):

| Env var | Default | Controls |
|---|---|---|
| `PR2_UPLOAD_DIR` | `./uploads` | where uploaded invoice files are stored |
| `PR2_QTY_TOLERANCE_PCT` | `2` | max % variance between invoice qty and goods received before it's a mismatch |
| `PR2_PRICE_TOLERANCE_PCT` | `2` | max % variance between invoice unit price and PO unit price |
| `PR2_SUPPLIER_WEIGHT_PRICE` / `_LEAD_TIME` / `_OTD` / `_QUALITY` | `0.35` / `0.15` / `0.25` / `0.25` | deterministic supplier-scoring weights, should sum to 1.0 |

---

## 9. Project structure

```
pr2-backend/
├── pom.xml
├── mvnw, mvnw.cmd, .mvn/          # Maven wrapper — no system Maven required
├── Dockerfile
├── SETUP.md                       # this file
├── local-dev/                     # LOCAL DEV ONLY, not part of the real Supabase deployment
│   ├── docker-compose.yml         # throwaway Postgres container
│   └── init-db.sql                # pr2 schema + seed data, mirrors Section 7.2
└── src/main/
    ├── java/com/chainvision/pr2/
    │   ├── Pr2Application.java
    │   ├── config/                # SecurityConfig (temporary permit-all, replaced in Phase 23)
    │   ├── controller/            # thin — delegates to services
    │   ├── service/                # business logic lives here (deterministic scoring, matching, etc.)
    │   ├── repository/            # Spring Data JPA
    │   ├── entity/                 # JPA entities + enums
    │   ├── dto/                    # request/response DTOs, Bean Validation
    │   ├── exception/              # GlobalExceptionHandler + typed exceptions
    │   └── ai/                     # GeminiClient + the 3 AI-scoped services (intent, OCR, mismatch explanation)
    └── resources/application.yml
```

All eight P2P modules from Section 13.2 are implemented: Requisitions
(manual + P1 handoff + NL intent parsing), Suppliers (deterministic scoring),
Purchase Orders, Goods Receipts, Invoices (OCR upload), 3-Way Match,
Exceptions, and Analytics. See the API table in §5 above.

**Not yet implemented** (out of scope for this pass, tracked here so it's
not forgotten): Phase 23 real auth (Supabase JWT verification — `SecurityConfig`
still permits all requests), the PR2 → P1 realtime webhook relay (Section 8),
and automated tests. The deterministic business logic (supplier scoring,
3-way match, PO/GRN status transitions) is exactly the kind of code that
benefits most from unit tests — worth prioritizing next if there's time.

---

## 10. Troubleshooting

- **Hikari pool fails to start / connection refused** — the local Postgres
  container isn't running. `docker ps` should show `pr2-local-postgres`; if
  not, re-run the `docker compose -f local-dev/docker-compose.yml up -d`
  command from §3.
- **Port 8080 already in use** — set `PR2_PORT` to something else:
  `PR2_PORT=8081 ./mvnw spring-boot:run`.
- **Port 5433 already in use** — another local-dev Postgres is already
  running (possibly from a previous session); `docker ps` and reuse it, or
  change the host port mapping in `local-dev/docker-compose.yml`.
- **`./mvnw` permission denied** — `chmod +x mvnw` (git should preserve the
  executable bit on clone, but some transfer methods strip it).
