package com.chainvision.pr2.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

@Service
public class InvoiceOcrService {

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    public InvoiceOcrService(GeminiClient geminiClient, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
    }

    public OcrExtractionResult extract(byte[] fileBytes, String mimeType) {
        String prompt =
                """
                Extract structured fields from this invoice document. Respond with JSON only, \
                no markdown, matching exactly this shape:
                {"invoiceNumber": string, "poNumber": string|null, "vendorName": string, \
                "quantity": number, "unitPrice": number, "totalAmount": number}

                If a field cannot be read, use null rather than guessing.
                """;
        try {
            String json = geminiClient.generateJsonFromDocument(prompt, fileBytes, mimeType);
            return objectMapper.readValue(json, OcrExtractionResult.class);
        } catch (GeminiUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiUnavailableException("Could not parse OCR extraction result: " + e.getMessage(), e);
        }
    }
}
