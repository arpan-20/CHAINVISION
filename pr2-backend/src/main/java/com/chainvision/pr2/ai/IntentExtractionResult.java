package com.chainvision.pr2.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Structured output of NL requisition intent extraction — Documentaion/00_PROJECT_CONTEXT.md
// Section 9.1. Pre-fills a requisition form for human confirmation; never auto-creates a
// requisition by itself (Section 5.1's hard rule keeps quantity decisions deterministic/human-owned).
@JsonIgnoreProperties(ignoreUnknown = true)
public record IntentExtractionResult(
        String skuGuess, Integer quantity, String dcGuess, String urgency, Double confidence) {
}
