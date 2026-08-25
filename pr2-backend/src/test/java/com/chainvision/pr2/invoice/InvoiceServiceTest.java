package com.chainvision.pr2.invoice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.invoice.InvoiceStructuringService.StructuredInvoice;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

class InvoiceServiceTest {

    @TempDir
    Path uploadDir;

    @Test
    void uploadAndExtractPersistsStructuredInvoiceFromP1OcrAndGeminiTextStructuring() {
        InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        OcrClient ocrClient = mock(OcrClient.class);
        InvoiceStructuringService structuringService = mock(InvoiceStructuringService.class);
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ocrClient.extractRawText(any(), any(), any())).thenReturn("Invoice Number: INV-MED104-001");
        when(structuringService.structure("Invoice Number: INV-MED104-001"))
                .thenReturn(new StructuredInvoice(
                        "INV-MED104-001",
                        "PO-MED104-001",
                        "MedSure Life Sciences",
                        1200,
                        new BigDecimal("10.325"),
                        new BigDecimal("12390.00"),
                        "{\"invoiceNumber\":\"INV-MED104-001\"}",
                        false));

        InvoiceService service = new InvoiceService(
                invoiceRepository, ocrClient, structuringService, new ObjectMapper(), uploadDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file", "invoice_matching.pdf", "application/pdf", "fake pdf".getBytes());
        UUID poId = UUID.randomUUID();

        Invoice invoice = service.uploadAndExtract(file, poId, null, null, null, null);

        assertThat(invoice.getPoId()).isEqualTo(poId);
        assertThat(invoice.getInvoiceNumber()).isEqualTo("INV-MED104-001");
        assertThat(invoice.getVendorNameOcr()).isEqualTo("MedSure Life Sciences");
        assertThat(invoice.getQuantityOcr()).isEqualTo(1200);
        assertThat(invoice.getUnitPriceOcr()).isEqualByComparingTo("10.325");
        assertThat(invoice.getTotalOcr()).isEqualByComparingTo("12390.00");
        assertThat(invoice.getRawOcrJson()).isEqualTo("{\"invoiceNumber\":\"INV-MED104-001\"}");
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.PENDING_MATCH);
        verify(ocrClient).extractRawText(any(), any(), any());
    }

    @Test
    void uploadAndExtractPersistsManualReviewInvoiceWhenOcrFails() {
        InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        OcrClient ocrClient = mock(OcrClient.class);
        InvoiceStructuringService structuringService = mock(InvoiceStructuringService.class);
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ocrClient.extractRawText(any(), any(), any())).thenThrow(new OcrClient.OcrClientException("P1 unavailable"));

        InvoiceService service = new InvoiceService(
                invoiceRepository, ocrClient, structuringService, new ObjectMapper(), uploadDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file", "invoice_matching.pdf", "application/pdf", "fake pdf".getBytes());

        Invoice invoice = service.uploadAndExtract(file, null, null, null, null, null);

        assertThat(invoice.getInvoiceNumber()).startsWith("UNREAD-");
        assertThat(invoice.getVendorNameOcr()).isEqualTo("UNKNOWN_VENDOR");
        assertThat(invoice.getQuantityOcr()).isZero();
        assertThat(invoice.getUnitPriceOcr()).isEqualByComparingTo("0.00");
        assertThat(invoice.getTotalOcr()).isEqualByComparingTo("0.00");
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.PENDING_MATCH);
        assertThat(invoice.getRawOcrJson()).contains("\"manualReviewRequired\":true");

        ArgumentCaptor<Invoice> invoiceCaptor = ArgumentCaptor.forClass(Invoice.class);
        verify(invoiceRepository).save(invoiceCaptor.capture());
        assertThat(invoiceCaptor.getValue().getRawOcrJson()).contains("P1 unavailable");
    }
}
