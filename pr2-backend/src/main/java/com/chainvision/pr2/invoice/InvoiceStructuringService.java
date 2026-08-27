package com.chainvision.pr2.invoice;

import com.chainvision.pr2.ai.GeminiClient;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
            // The OCR text is already available from P1.  Keep the invoice
            // matchable when Gemini is unavailable by extracting the simple
            // labelled fields used by our invoices deterministically.  This
            // is only a fallback parser; Gemini remains the primary
            // structuring path for arbitrary invoice layouts.
            StructuredInvoice fallback = structureLabelledText(rawOcrText);
            if (fallback != null) {
                return fallback;
            }
            return StructuredInvoice.manualReview(
                    writeJson(Map.of(
                            "manualReviewRequired", true,
                            "stage", "GEMINI_STRUCTURING",
                            "reason", safeMessage(e),
                            "rawOcrText", rawOcrText == null ? "" : rawOcrText)));
        }
    }

    private StructuredInvoice structureLabelledText(String rawOcrText) {
        if (rawOcrText == null || rawOcrText.isBlank()) {
            return null;
        }
        String invoiceNumber = labelled(rawOcrText, "Invoice\\s+Number");
        String poNumber = labelled(rawOcrText, "PO\\s+Number");
        String vendorName = labelled(rawOcrText, "Vendor");
        Integer quantity = integerLabel(rawOcrText, "Quantity");
        BigDecimal unitPrice = decimalLabel(rawOcrText, "Unit\\s+Price");
        BigDecimal total = decimalLabel(rawOcrText, "Total");
        // Require the numeric fields needed by the matching engine. A partial
        // fragment (for example only an invoice number) must remain manual
        // review rather than producing a misleading zero-valued invoice.
        if (quantity == null || unitPrice == null) {
            return null;
        }
        try {
            Map<String, Object> parsed = new LinkedHashMap<>();
            parsed.put("fallbackParser", "labelled-ocr");
            parsed.put("invoiceNumber", invoiceNumber);
            parsed.put("poNumber", poNumber);
            parsed.put("vendorName", vendorName);
            parsed.put("quantity", quantity);
            parsed.put("unitPrice", unitPrice);
            parsed.put("totalAmount", total);
            String rawJson = objectMapper.writeValueAsString(parsed);
            return new StructuredInvoice(invoiceNumber, poNumber, vendorName, quantity, unitPrice, total, rawJson, false);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String labelled(String text, String label) {
        Matcher matcher = Pattern.compile("(?im)^\\s*" + label + "\\s*:\\s*(.+?)\\s*$").matcher(text);
        return matcher.find() ? matcher.group(1).trim() : null;
    }

    private static Integer integerLabel(String text, String label) {
        String value = labelled(text, label);
        if (value == null) return null;
        Matcher matcher = Pattern.compile("[0-9]+").matcher(value.replace(",", ""));
        return matcher.find() ? Integer.valueOf(matcher.group()) : null;
    }

    private static BigDecimal decimalLabel(String text, String label) {
        String value = labelled(text, label);
        if (value == null) return null;
        Matcher matcher = Pattern.compile("[0-9]+(?:\\.[0-9]+)?").matcher(value.replace(",", ""));
        return matcher.find() ? new BigDecimal(matcher.group()) : null;
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
