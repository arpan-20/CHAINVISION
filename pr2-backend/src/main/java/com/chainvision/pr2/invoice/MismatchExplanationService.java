package com.chainvision.pr2.invoice;

import com.chainvision.pr2.ai.GeminiClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

// Gemini is explanation-only. It receives the already-computed mismatch fields/values and never
// sees PO/GRN/invoice objects or decides match status.
@Service
public class MismatchExplanationService {

    private static final Logger log = LoggerFactory.getLogger(MismatchExplanationService.class);

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    public MismatchExplanationService(GeminiClient geminiClient, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
    }

    public String explain(String deterministicMismatchSummary) {
        if (!geminiClient.isConfigured()) {
            return deterministicMismatchSummary;
        }
        String prompt =
                """
                Given this already-computed procurement 3-way match mismatch, phrase a one-sentence
                plain-English explanation for a procurement officer's exception queue. Do not change
                any numbers and do not decide whether the match passes or fails.
                Respond with JSON only: {"explanation": string}

                Mismatch details: %s
                """
                        .formatted(deterministicMismatchSummary);
        try {
            String json = geminiClient.generateJson(prompt);
            JsonNode node = objectMapper.readTree(json);
            String explanation = node.path("explanation").asText(null);
            return explanation != null ? explanation : deterministicMismatchSummary;
        } catch (Exception e) {
            log.warn("Falling back to deterministic mismatch summary, Gemini explanation failed: {}", e.getMessage());
            return deterministicMismatchSummary;
        }
    }
}
