package com.chainvision.pr2.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

@Service
public class IntentExtractionService {

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    public IntentExtractionService(GeminiClient geminiClient, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
    }

    public IntentExtractionResult extract(String freeText) {
        String prompt =
                """
                Extract a structured procurement requisition intent from the following free-text \
                message. Respond with JSON only, no markdown, matching exactly this shape:
                {"skuGuess": string, "quantity": number, "dcGuess": string, "urgency": \
                "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "confidence": number between 0 and 1}

                Message: "%s"
                """
                        .formatted(freeText);
        try {
            String json = geminiClient.generateJson(prompt);
            return objectMapper.readValue(json, IntentExtractionResult.class);
        } catch (GeminiUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiUnavailableException("Could not parse intent extraction result: " + e.getMessage(), e);
        }
    }
}
