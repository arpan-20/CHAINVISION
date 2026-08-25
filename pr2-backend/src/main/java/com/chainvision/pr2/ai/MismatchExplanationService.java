package com.chainvision.pr2.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

// Generates the plain-English exception-queue explanation described in
// Documentaion/00_PROJECT_CONTEXT.md Section 9.2. Gemini is only ever given the *already computed*
// deterministic mismatch details and asked to describe them — never to decide the match result
// itself. Falls back to a canned template if Gemini isn't configured or the call fails, so the
// 3-way match endpoint keeps working end-to-end without an API key (Section 5.7).
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
                Given this already-computed procurement 3-way match mismatch, phrase a one-sentence \
                plain-English explanation for a procurement officer's exception queue. Do not change \
                any numbers. Respond with JSON only: {"explanation": string}

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
