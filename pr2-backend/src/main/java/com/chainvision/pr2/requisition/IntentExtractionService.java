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
            // Keep the chatbot useful when Gemini is unavailable (missing key,
            // transient provider error, or an invalid model).  This deliberately
            // extracts only unambiguous local patterns; the UI still requires
            // explicit confirmation before creating the requisition.
            return deterministicFallback(freeText);
        }
    }

    private static IntentExtractionResult deterministicFallback(String freeText) {
        String sku = find(freeText, "(?i)\\b[A-Z]{2,10}-\\d{2,}[A-Z0-9-]*\\b");
        String quantityText = find(freeText.replaceAll(",", ""), "(?i)\\b\\d+\\b(?=\\s*(?:units?|items?|packs?|qty|quantity)\\b)");
        if (quantityText == null) {
            quantityText = find(freeText.replaceAll(",", ""), "(?i)(?:need|requires?|order)\\s+(\\d+)\\b");
        }
        Integer quantity = quantityText == null ? null : Integer.valueOf(quantityText);
        String dc = find(freeText, "(?i)\\b(?:DC|DISTRIBUTION CENTER)[ -]?[A-Z0-9]+\\b");
        String urgency = find(freeText, "(?i)\\b(?:LOW|MEDIUM|HIGH|CRITICAL)\\b");
        if (sku == null && quantity == null && dc == null && urgency == null) {
            return IntentExtractionResult.manualEntry("No deterministic intent found");
        }
        boolean complete = sku != null && quantity != null;
        return new IntentExtractionResult(
                sku,
                quantity,
                dc,
                urgency == null ? null : urgency.toUpperCase(),
                complete ? 0.75 : 0.25,
                !complete);
    }

    private static String find(String text, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex).matcher(text);
        return matcher.find() ? matcher.group(matcher.groupCount()) : null;
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
