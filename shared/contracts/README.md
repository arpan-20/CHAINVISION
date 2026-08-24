# Shared Contracts

The files in this directory define payloads shared across CHAINVISION services.

## Replenishment recommendation

`replenishmentRecommendation.schema.json` is the P1-to-PR2 handoff contract. P1 emits one object after its deterministic replenishment calculation, and PR2 consumes the same object at its recommendation receiver endpoint to create a system-generated purchase requisition.

The payload contains identifiers, the already-computed quantity and urgency, deterministic and AI-readable context, and its ISO-8601 generation timestamp. PR2 should validate incoming payloads against this schema and mirror its fields in `ReplenishmentRecommendationDto`.

The contract deliberately contains no supplier, purchase-order, invoice, or payment fields. Those decisions remain inside PR2 after the handoff.