package com.chainvision.pr2.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.goodsreceipt.GoodsReceipt;
import com.chainvision.pr2.goodsreceipt.GoodsReceiptRepository;
import com.chainvision.pr2.invoice.Invoice;
import com.chainvision.pr2.invoice.InvoiceRepository;
import com.chainvision.pr2.invoice.InvoiceStatus;
import com.chainvision.pr2.invoice.MatchResult;
import com.chainvision.pr2.invoice.MismatchExplanationService;
import com.chainvision.pr2.invoice.ThreeWayMatch;
import com.chainvision.pr2.invoice.ThreeWayMatchRepository;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import com.chainvision.pr2.purchaseorder.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MatchingServiceTest {

    @Test
    void runMatchDoesNotCallGeminiExplanationForMatchedInvoice() {
        Fixture fixture = fixture(1200, "10.325", 1200, "10.325");

        ThreeWayMatch match = fixture.service().runMatch(fixture.invoice().getId());

        assertThat(match.getResult()).isEqualTo(MatchResult.MATCHED);
        assertThat(match.getAiExplanation()).isNull();
        assertThat(fixture.invoice().getStatus()).isEqualTo(InvoiceStatus.MATCHED);
        verify(fixture.mismatchExplanationService(), never()).explain(any());
    }

    @Test
    void runMatchCallsGeminiExplanationOnlyAfterDeterministicMismatch() {
        Fixture fixture = fixture(1200, "10.325", 900, "10.325");
        when(fixture.mismatchExplanationService().explain(any())).thenReturn("Quantity is lower than received.");

        ThreeWayMatch match = fixture.service().runMatch(fixture.invoice().getId());

        assertThat(match.getResult()).isEqualTo(MatchResult.MISMATCHED);
        assertThat(match.getMismatchReason()).contains("Invoice quantity (900)").contains("goods received (1200)");
        assertThat(match.getAiExplanation()).isEqualTo("Quantity is lower than received.");
        assertThat(fixture.invoice().getStatus()).isEqualTo(InvoiceStatus.MISMATCHED);
        verify(fixture.mismatchExplanationService()).explain(match.getMismatchReason());
    }

    private static Fixture fixture(int receivedQty, String poUnitPrice, int invoiceQty, String invoiceUnitPrice) {
        InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        PurchaseOrderRepository purchaseOrderRepository = mock(PurchaseOrderRepository.class);
        GoodsReceiptRepository goodsReceiptRepository = mock(GoodsReceiptRepository.class);
        ThreeWayMatchRepository threeWayMatchRepository = mock(ThreeWayMatchRepository.class);
        MismatchExplanationService mismatchExplanationService = mock(MismatchExplanationService.class);

        PurchaseOrder po = new PurchaseOrder(UUID.randomUUID(), UUID.randomUUID(), receivedQty, new BigDecimal(poUnitPrice));
        GoodsReceipt grn = new GoodsReceipt(po.getId(), receivedQty, "B100", LocalDate.parse("2027-06-01"));
        Invoice invoice = new Invoice(
                po.getId(),
                "INV-TEST",
                "Test Vendor",
                invoiceQty,
                new BigDecimal(invoiceUnitPrice),
                new BigDecimal(invoiceUnitPrice).multiply(BigDecimal.valueOf(invoiceQty)),
                "{}",
                "invoice.pdf");

        when(invoiceRepository.findById(invoice.getId())).thenReturn(Optional.of(invoice));
        when(purchaseOrderRepository.findById(po.getId())).thenReturn(Optional.of(po));
        when(goodsReceiptRepository.findByPoId(po.getId())).thenReturn(List.of(grn));
        when(threeWayMatchRepository.save(any(ThreeWayMatch.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MatchingService service = new MatchingService(
                invoiceRepository,
                purchaseOrderRepository,
                goodsReceiptRepository,
                threeWayMatchRepository,
                mismatchExplanationService,
                BigDecimal.valueOf(2),
                BigDecimal.valueOf(2));
        return new Fixture(service, invoice, mismatchExplanationService);
    }

    private record Fixture(
            MatchingService service, Invoice invoice, MismatchExplanationService mismatchExplanationService) {
    }
}
