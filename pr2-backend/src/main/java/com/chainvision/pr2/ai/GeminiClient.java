package com.chainvision.pr2.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

// Thin wrapper around the Google Gemini generateContent API (Documentaion/00_PROJECT_CONTEXT.md
// Section 5.7). Used for exactly the AI-scoped responsibilities in Section 9: NL requisition
// intent extraction, invoice OCR-text structuring, and mismatch explanation text — never for
// numeric/business decisions (Section 5.1's hard rule).
@Component
public class GeminiClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public GeminiClient(
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-2.0-flash}") String model,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.model = model;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    // Sends a text-only prompt, requesting a JSON-only response. Returns the raw text
    // (expected to be a JSON document); callers parse it into their own shape defensively.
    public String generateJson(String prompt) {
        return call(Map.of("parts", List.of(Map.of("text", prompt))));
    }

    public String generateJson(String prompt, String schemaHint) {
        return generateJson(prompt + "\n\nReturn JSON matching this schema hint:\n" + schemaHint);
    }

    // Generic multimodal hook retained for future scoped uses; Phase 16 invoice processing uses
    // P1/Tesseract raw OCR first, then the text-only generateJson(...) path for structuring.
    public String generateJsonFromDocument(String prompt, byte[] fileBytes, String mimeType) {
        String base64 = Base64.getEncoder().encodeToString(fileBytes);
        return call(Map.of(
                "parts",
                List.of(
                        Map.of("text", prompt),
                        Map.of("inline_data", Map.of("mime_type", mimeType, "data", base64)))));
    }

    private String call(Map<String, Object> contentPart) {
        if (!isConfigured()) {
            throw new GeminiUnavailableException("GEMINI_API_KEY is not configured");
        }
        Map<String, Object> requestBody = Map.of(
                "contents", List.of(contentPart),
                "generationConfig", Map.of("responseMimeType", "application/json"));
        try {
            return RateLimitAwareRetry.execute(
                    () -> requestJson(requestBody), "Gemini generateContent");
        } catch (GeminiUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiUnavailableException("Gemini call failed: " + e.getMessage(), e);
        }
    }

    private String requestJson(Map<String, Object> requestBody) {
        String responseJson = restClient.post()
                .uri("/v1beta/models/{model}:generateContent?key={key}", model, apiKey)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(String.class);
        return extractText(responseJson);
    }

    private String extractText(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            String text = root.path("candidates")
                    .path(0)
                    .path("content")
                    .path("parts")
                    .path(0)
                    .path("text")
                    .asText(null);
            if (text == null) {
                throw new GeminiUnavailableException("Gemini response had no text candidate: " + responseJson);
            }
            return stripMarkdownFences(text);
        } catch (GeminiUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiUnavailableException("Could not parse Gemini response: " + e.getMessage(), e);
        }
    }

    // Gemini sometimes wraps JSON in ```json ... ``` fences even with responseMimeType set.
    private String stripMarkdownFences(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```[a-zA-Z]*\\n", "");
            trimmed = trimmed.replaceFirst("```\\s*$", "");
        }
        return trimmed.trim();
    }
}
