package com.chainvision.pr2.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.invoice.Invoice;
import com.chainvision.pr2.invoice.InvoiceRepository;
import com.chainvision.pr2.invoice.InvoiceStatus;
import com.chainvision.pr2.invoice.MatchResult;
import com.chainvision.pr2.invoice.ThreeWayMatch;
import com.chainvision.pr2.invoice.ThreeWayMatchRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PaymentApprovalServiceTest {

    @Test
    void processMatchedResultCreatesAutoApprovedPayment() {
        Fixture fixture = fixture();
        fixture.invoice().markMatched();

        PaymentApproval approval =
                fixture.service().processMatchResult(fixture.invoice().getId(), MatchResult.MATCHED);

        assertThat(approval.getInvoiceId()).isEqualTo(fixture.invoice().getId());
        assertThat(approval.getStatus()).isEqualTo(PaymentStatus.AUTO_APPROVED);
        assertThat(approval.getApprovedBy()).isEqualTo("SYSTEM");
        assertThat(approval.getApprovedAt()).isNotNull();
        assertThat(fixture.invoice().getStatus()).isEqualTo(InvoiceStatus.MATCHED);
        verify(fixture.paymentApprovalRepository()).save(any(PaymentApproval.class));
    }

    @Test
    void processMismatchedResultCreatesPendingReviewAndMarksInvoiceException() {
        Fixture fixture = fixture();

        PaymentApproval approval =
                fixture.service().processMatchResult(fixture.invoice().getId(), MatchResult.MISMATCHED);

        assertThat(approval.getStatus()).isEqualTo(PaymentStatus.PENDING_REVIEW);
        assertThat(approval.getApprovedBy()).isNull();
        assertThat(approval.getApprovedAt()).isNull();
        assertThat(fixture.invoice().getStatus()).isEqualTo(InvoiceStatus.EXCEPTION);
    }

    @Test
    void listExceptionsIncludesPendingReviewApprovalAndLatestMatch() {
        Fixture fixture = fixture();
        fixture.invoice().markException();
        PaymentApproval pending =
                new PaymentApproval(fixture.invoice().getId(), PaymentStatus.PENDING_REVIEW, null, null);
        ThreeWayMatch match = new ThreeWayMatch(
                fixture.invoice().getId(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                false,
                true,
                MatchResult.MISMATCHED,
                "Invoice quantity (700) does not match goods received (900); exceeds 2% tolerance.",
                "Quantity needs review.");
        when(fixture.paymentApprovalRepository().findByStatus(PaymentStatus.PENDING_REVIEW))
                .thenReturn(List.of(pending));
        when(fixture.threeWayMatchRepository().findLatestByInvoiceId(fixture.invoice().getId()))
                .thenReturn(Optional.of(match));

        List<PaymentApprovalService.ExceptionQueueItem> exceptions = fixture.service().listExceptions();

        assertThat(exceptions).hasSize(1);
        assertThat(exceptions.get(0).paymentApproval()).isEqualTo(pending);
        assertThat(exceptions.get(0).latestMatch().getAiExplanation()).isEqualTo("Quantity needs review.");
    }

    @Test
    void resolveApproveUpdatesPendingReviewApprovalAndMarksInvoiceApproved() {
        Fixture fixture = fixture();
        fixture.invoice().markException();
        PaymentApproval pending =
                new PaymentApproval(fixture.invoice().getId(), PaymentStatus.PENDING_REVIEW, null, null);
        when(fixture.paymentApprovalRepository().findPendingReviewByInvoiceId(fixture.invoice().getId()))
                .thenReturn(Optional.of(pending));

        PaymentApproval resolved =
                fixture.service().resolve(fixture.invoice().getId(), PaymentDecision.APPROVE, "buyer@example.com");

        assertThat(resolved.getStatus()).isEqualTo(PaymentStatus.APPROVED_MANUAL);
        assertThat(resolved.getApprovedBy()).isEqualTo("buyer@example.com");
        assertThat(resolved.getApprovedAt()).isNotNull();
        assertThat(fixture.invoice().getStatus()).isEqualTo(InvoiceStatus.APPROVED);
    }

    @Test
    void resolveRejectUpdatesPendingReviewApprovalWithoutApprovingInvoice() {
        Fixture fixture = fixture();
        fixture.invoice().markException();
        PaymentApproval pending =
                new PaymentApproval(fixture.invoice().getId(), PaymentStatus.PENDING_REVIEW, null, null);
        when(fixture.paymentApprovalRepository().findPendingReviewByInvoiceId(fixture.invoice().getId()))
                .thenReturn(Optional.of(pending));

        PaymentApproval resolved =
                fixture.service().resolve(fixture.invoice().getId(), PaymentDecision.REJECT, "buyer@example.com");

        assertThat(resolved.getStatus()).isEqualTo(PaymentStatus.REJECTED);
        assertThat(resolved.getApprovedBy()).isEqualTo("buyer@example.com");
        assertThat(fixture.invoice().getStatus()).isEqualTo(InvoiceStatus.EXCEPTION);
    }

    private static Fixture fixture() {
        PaymentApprovalRepository paymentApprovalRepository = mock(PaymentApprovalRepository.class);
        InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        ThreeWayMatchRepository threeWayMatchRepository = mock(ThreeWayMatchRepository.class);
        Invoice invoice = new Invoice(
                UUID.randomUUID(),
                "INV-TEST",
                "Test Vendor",
                100,
                BigDecimal.TEN,
                BigDecimal.valueOf(1000),
                "{}",
                "invoice.pdf");

        when(invoiceRepository.findById(invoice.getId())).thenReturn(Optional.of(invoice));
        when(paymentApprovalRepository.save(any(PaymentApproval.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PaymentApprovalService service =
                new PaymentApprovalService(paymentApprovalRepository, invoiceRepository, threeWayMatchRepository);
        return new Fixture(service, invoice, paymentApprovalRepository, threeWayMatchRepository);
    }

    private record Fixture(
            PaymentApprovalService service,
            Invoice invoice,
            PaymentApprovalRepository paymentApprovalRepository,
            ThreeWayMatchRepository threeWayMatchRepository) {
    }
}
