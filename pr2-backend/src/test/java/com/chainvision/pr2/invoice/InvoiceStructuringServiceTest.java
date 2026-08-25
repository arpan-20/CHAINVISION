package com.chainvision.pr2.invoice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.ai.GeminiClient;
import com.chainvision.pr2.invoice.InvoiceStructuringService.StructuredInvoice;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class InvoiceStructuringServiceTest {

    @Test
    void structureParsesGeminiJsonFromRawOcrText() {
        GeminiClient geminiClient = mock(GeminiClient.class);
        when(geminiClient.generateJson(contains("Raw OCR text:"), anyString()))
                .thenReturn(
                        """
                        {
                          "invoiceNumber": "INV-MED104-001",
                          "poNumber": "PO-MED104-001",
                          "vendorName": "MedSure Life Sciences",
                          "quantity": 1200,
                          "unitPrice": 10.325,
                          "totalAmount": 12390.00,
                          "manualReviewRequired": false
                        }
                        """);

        InvoiceStructuringService service = new InvoiceStructuringService(geminiClient, new ObjectMapper());

        StructuredInvoice result = service.structure("Invoice Number: INV-MED104-001");

        assertThat(result.invoiceNumber()).isEqualTo("INV-MED104-001");
        assertThat(result.poNumber()).isEqualTo("PO-MED104-001");
        assertThat(result.vendorName()).isEqualTo("MedSure Life Sciences");
        assertThat(result.quantity()).isEqualTo(1200);
        assertThat(result.unitPrice()).isEqualByComparingTo("10.325");
        assertThat(result.totalAmount()).isEqualByComparingTo("12390.00");
        assertThat(result.manualReviewRequired()).isFalse();
    }

    @Test
    void structureReturnsManualReviewResultWhenGeminiJsonCannotBeParsed() {
        GeminiClient geminiClient = mock(GeminiClient.class);
        when(geminiClient.generateJson(contains("Raw OCR text:"), anyString())).thenReturn("not json");
        InvoiceStructuringService service = new InvoiceStructuringService(geminiClient, new ObjectMapper());

        StructuredInvoice result = service.structure("Invoice Number: INV-MED104-001");

        assertThat(result.manualReviewRequired()).isTrue();
        assertThat(result.invoiceNumber()).isNull();
        assertThat(result.rawJson()).contains("\"manualReviewRequired\":true");
        assertThat(result.rawJson()).contains("GEMINI_STRUCTURING");
    }
}
