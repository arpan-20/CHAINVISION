# PR2 Core Engine Test Coverage Summary

**Generated:** Phase 25 (P25.2) — PR2 Unit Test Suite Review & Gap-Fill  
**Verified:** 2026-08-26 via `mvnw.cmd test` (JDK 25, surefire)  
**Result:** `Tests run: 20, Failures: 0, Errors: 0, Skipped: 0`

---

## Verified Test Counts

| Engine | Test Class | Cases | Status |
|--------|-----------|-------|--------|
| **Supplier Scoring Engine** | `SupplierScoringEngineTest.java` | **8** (3 existing + 5 added) | ✅ all pass |
| **Three-Way Match Engine** | `ThreeWayMatchEngineTest.java` | **12** (4 existing + 8 added) | ✅ all pass |

Both classes exceed the ≥6-case acceptance bar.

---

## Coverage by Scenario

### SupplierScoringEngine (weights: price 0.35 / lead-time 0.15 / OTD 0.25 / quality 0.25)

*Existing (P10.1):*
1. Reliable supplier ranks above cheap-but-unreliable (weighted ranking sanity)
2. Suppliers below required capacity are filtered before scoring
3. No eligible supplier → `BusinessRuleViolationException`

*Added this phase:*
4. **Capacity boundary exactly equal to requirement is eligible** (`>=`, not `>`)
5. **All suppliers identical → every axis normalizes to 1, identical scores of 1.0000**
6. **Score tie (mirror metrics) → deterministic total ordering, no exception, both returned**
7. Single eligible supplier → perfect normalized score via `selectBestSupplier`
8. Cheaper supplier wins when performance metrics are equal (price-axis discrimination)

### ThreeWayMatchEngine (default 2% quantity & price tolerance)

*Existing (P17.1):*
1. Exact quantity + price match → MATCHED
2. Quantity mismatch beyond tolerance → MISMATCHED with invoice-vs-receipt reason
3. Price mismatch beyond tolerance → MISMATCHED with price reason
4. Both mismatch → MISMATCHED with combined reasons

*Added this phase:*
5. **Exactly 2% quantity off (1020 vs 1000) → still MATCHED** (tolerance is inclusive `<=`)
6. Just beyond 2% (1021 vs 1000 = 2.1%) → MISMATCHED
7. **Exactly 2% price off (5.10 vs 5.00) → still MATCHED**
8. Just beyond 2% price (5.11 vs 5.00 = 2.2%) → MISMATCHED
9. Zero invoice quantity vs non-zero received → MISMATCHED, reason mentions `(0)`
10. All-zero quantities → matches (expected==0 branch requires actual==0)
11. GoodsReceipt-backed overload delegates to GRN receivedQty; short GRN surfaces the "Goods received quantity ... does not match PO quantity" reason; full GRN + consistent invoice → MATCHED
12. Custom-tolerance constructor honored (4% diff passes at 5% tolerance)

---

## Formulas Under Test

| Rule | Behavior verified |
|---|---|
| Quantity match | `invoice↔GRN` AND `GRN↔PO`, each within 2% inclusive |
| Price match | `invoice.unitPrice ↔ PO.unitPrice` within 2% inclusive |
| Tolerance math | `\|actual − expected\| ÷ expected × 100 ≤ tolerance` (6-dp HALF_UP intermediate scale) |
| Zero-expected guard | expected 0 matches only actual 0 (no divide-by-zero) |
| Supplier filter | `capacityUnits >= requiredCapacity` (boundary inclusive) |
| Normalization | min-max; degenerate range (max==min) → normalized to 1 for ALL suppliers |
| Score | weighted sum, rounded HALF_UP to 4 dp; sort descending |

---

## 🐞 Findings Reported (not fixed — test-only prompt)

### 1. Score ties have no documented tie-breaker (Low severity)
`rankEligibleSuppliers` sorts only by score descending. When two suppliers tie exactly,
ordering falls back to Java's stable merge-sort over the repository's input order — so the
winner depends on `findAll()`'s return order rather than an explicit business rule.
Not a crash (test #6 proves determinism), but for auditability the coordinator may want a
documented secondary key (e.g., lower lead time, then lower price index).

### 2. Degenerate-range normalization inflates scores (Design note)
When all eligible suppliers share an identical metric value on some axis, that axis
normalizes to **1 for everyone** — not 0 or a neutral value. Combined across axes this can
make a lone mediocre supplier look perfect (score 1.0000 in test #7). Acceptable for the
hackathon demo but worth flagging as a modeling choice.

### 3. Tolerance inclusivity at exactly 2% is intentional but undocumented in code comments
The engine treats exactly-at-tolerance as a MATCH (`compareTo <= 0`). Tests now pin this
boundary behavior explicitly (tests #5 and #7) so any future change is caught.

No engine bugs requiring fixes were found — all failures during development were errors in
my own new test code (a missing import and two wrong expectations), corrected before final run.

---

## How to Run

```bash
cd pr2-backend
# Windows (JDK 25 installed at C:\Program Files\Java\jdk-25.0.3):
set JAVA_HOME=C:\Program Files\Java\jdk-25.0.3
mvnw.cmd test -Dtest="SupplierScoringEngineTest,ThreeWayMatchEngineTest"
# Result: Tests run: 20, Failures: 0, Errors: 0, Skipped: 0
```

> Note: earlier audits recorded that Maven could not start in the audit environment.
> It runs fine once `JAVA_HOME` points at the installed JDK; no wrapper changes were needed.

## Gaps Intentionally Left for Time Reasons
- No property-based testing of the normalization math (e.g., random-metric fuzzing via jqwik)
- `MatchingServiceTest`, `RequisitionServiceTest`, etc. are service-layer tests outside P25.2's scope (covered under the broader P25 review umbrella)
- No JaCoCo coverage % configured; counts used as proxy