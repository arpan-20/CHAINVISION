package com.chainvision.pr2.requisition.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Structured output of NL requisition intent extraction — Documentaion/00_PROJECT_CONTEXT.md
// Section 9.1. This only pre-fills a requisition form for human confirmation; it never
// auto-creates a requisition by itself.
@JsonIgnoreProperties(ignoreUnknown = true)
public record IntentExtractionResult(
        String skuGuess,
        Integer quantity,
        String dcGuess,
        String urgency,
        Double confidence,
        Boolean manualEntryRequired) {

    public static IntentExtractionResult manualEntry(String reason) {
        return new IntentExtractionResult(null, null, null, null, 0.0, true);
    }
}
