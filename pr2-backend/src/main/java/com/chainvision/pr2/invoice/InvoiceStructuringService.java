package com.chainvision.pr2.invoice;

import com.chainvision.pr2.ai.GeminiClient;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class InvoiceStructuringService {

    private static final String SCHEMA_HINT =
            """
            {
              "invoiceNumber": "string or null",
              "poNumber": "string or null",
              "vendorName": "string or null",
              "quantity": "integer or null",
              "unitPrice": "decimal number or null",
              "totalAmount": "decimal number or null",
              "lineItems": [
                {
                  "sku": "string or null",
                  "description": "string or null",
                  "quantity": "integer or null",
                  "unitPrice": "decimal number or null",
                  "lineTotal": "decimal number or null"
                }
              ],
              "manualReviewRequired": false
            }
            """;

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    public InvoiceStructuringService(GeminiClient geminiClient, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
    }

    public StructuredInvoice structure(String rawOcrText) {
        String prompt =
                """
                Section 9/10 hard rule: use Gemini only to structure already-extracted OCR text.
                Return only JSON. Do not compute totals, do not validate against PO/GRN data,
                do not decide whether the invoice matches, and do not add explanation text.

                Extract these fields from the raw OCR text: invoiceNumber, poNumber, vendorName,
                quantity, unitPrice, totalAmount, and lineItems. If a field is missing, use null.

                Raw OCR text:
                %s
                """
                        .formatted(rawOcrText);

        try {
            String json = geminiClient.generateJson(prompt, SCHEMA_HINT);
            StructuredInvoicePayload payload = objectMapper.readValue(json, StructuredInvoicePayload.class);
            return StructuredInvoice.fromPayload(payload, json);
        } catch (Exception e) {
            return StructuredInvoice.manualReview(
                    writeJson(Map.of(
                            "manualReviewRequired", true,
                            "stage", "GEMINI_STRUCTURING",
                            "reason", safeMessage(e),
                            "rawOcrText", rawOcrText == null ? "" : rawOcrText)));
        }
    }

    private static String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{\"manualReviewRequired\":true}";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record StructuredInvoicePayload(
            String invoiceNumber,
            String poNumber,
            String vendorName,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal totalAmount,
            Boolean manualReviewRequired) {
    }

    public record StructuredInvoice(
            String invoiceNumber,
            String poNumber,
            String vendorName,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal totalAmount,
            String rawJson,
            boolean manualReviewRequired) {

        static StructuredInvoice fromPayload(StructuredInvoicePayload payload, String rawJson) {
            return new StructuredInvoice(
                    payload.invoiceNumber(),
                    payload.poNumber(),
                    payload.vendorName(),
                    payload.quantity(),
                    payload.unitPrice(),
                    payload.totalAmount(),
                    rawJson,
                    Boolean.TRUE.equals(payload.manualReviewRequired()));
        }

        static StructuredInvoice manualReview(String rawJson) {
            return new StructuredInvoice(null, null, null, null, null, null, rawJson, true);
        }
    }
}
