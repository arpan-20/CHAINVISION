package com.chainvision.pr2.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;

// Structured output of invoice document OCR/extraction — Documentaion/00_PROJECT_CONTEXT.md
// Section 10. Extraction only; the 3-way match decision is 100% separate deterministic code.
@JsonIgnoreProperties(ignoreUnknown = true)
public record OcrExtractionResult(
        String invoiceNumber,
        String poNumber,
        String vendorName,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal totalAmount) {
}
