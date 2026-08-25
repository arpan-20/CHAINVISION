package com.chainvision.pr2.requisition;

import com.chainvision.pr2.ai.GeminiClient;
import com.chainvision.pr2.requisition.dto.IntentExtractionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

@Service
public class IntentExtractionService {

    private static final String SCHEMA_HINT =
            """
            {
              "skuGuess": "string or null",
              "quantity": "integer or null",
              "dcGuess": "string or null",
              "urgency": "LOW | MEDIUM | HIGH | CRITICAL | null",
              "confidence": "number between 0 and 1",
              "manualEntryRequired": "boolean"
            }
            """;

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    public IntentExtractionService(GeminiClient geminiClient, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
    }

    public IntentExtractionResult extract(String freeText) {
        String prompt =
                """
                Extract a structured procurement requisition intent from the following free-text message.
                Respond with JSON only, no markdown, matching exactly this shape:
                {"skuGuess": string|null, "quantity": number|null, "dcGuess": string|null,
                "urgency": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"|null, "confidence": number between 0 and 1,
                "manualEntryRequired": boolean}

                Example: "We need 5,000 more units of MED-104 for the flu season."
                Expected key facts: skuGuess MED-104, quantity 5000.

                Section 9 hard rule: these values are guesses to pre-fill a form for human
                confirmation only. Do not make sourcing, purchasing, or business decisions.

                Message: "%s"
                """
                        .formatted(freeText);
        try {
            String json = geminiClient.generateJson(prompt, SCHEMA_HINT);
            IntentExtractionResult parsed = objectMapper.readValue(json, IntentExtractionResult.class);
            return withManualEntryDefault(parsed);
        } catch (Exception e) {
            return IntentExtractionResult.manualEntry(e.getMessage());
        }
    }

    private static IntentExtractionResult withManualEntryDefault(IntentExtractionResult parsed) {
        double confidence = parsed.confidence() != null ? parsed.confidence() : 0.0;
        boolean manualEntryRequired = parsed.manualEntryRequired() != null
                ? parsed.manualEntryRequired()
                : confidence <= 0.0;
        return new IntentExtractionResult(
                parsed.skuGuess(),
                parsed.quantity(),
                parsed.dcGuess(),
                parsed.urgency(),
                confidence,
                manualEntryRequired);
    }
}
