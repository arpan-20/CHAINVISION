package com.chainvision.pr2.payment;

import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.invoice.Invoice;
import com.chainvision.pr2.invoice.InvoiceRepository;
import com.chainvision.pr2.invoice.InvoiceStatus;
import com.chainvision.pr2.invoice.MatchResult;
import com.chainvision.pr2.invoice.ThreeWayMatch;
import com.chainvision.pr2.invoice.ThreeWayMatchRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentApprovalService {

    private final PaymentApprovalRepository paymentApprovalRepository;
    private final InvoiceRepository invoiceRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;

    public PaymentApprovalService(
            PaymentApprovalRepository paymentApprovalRepository,
            InvoiceRepository invoiceRepository,
            ThreeWayMatchRepository threeWayMatchRepository) {
        this.paymentApprovalRepository = paymentApprovalRepository;
        this.invoiceRepository = invoiceRepository;
        this.threeWayMatchRepository = threeWayMatchRepository;
    }

    @Transactional
    public PaymentApproval processMatchResult(UUID invoiceId, MatchResult matchResult) {
        Invoice invoice = invoiceRepository
                .findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));

        if (matchResult == MatchResult.MATCHED) {
            return paymentApprovalRepository.save(
                    new PaymentApproval(invoiceId, PaymentStatus.AUTO_APPROVED, "SYSTEM", OffsetDateTime.now()));
        }

        invoice.markException();
        PaymentApproval approval = paymentApprovalRepository.save(
                new PaymentApproval(invoiceId, PaymentStatus.PENDING_REVIEW, null, null));
        invoiceRepository.save(invoice);
        return approval;
    }

    public List<ExceptionQueueItem> listExceptions() {
        return paymentApprovalRepository.findByStatus(PaymentStatus.PENDING_REVIEW).stream()
                .map(approval -> {
                    Invoice invoice = invoiceRepository
                            .findById(approval.getInvoiceId())
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "Invoice not found: " + approval.getInvoiceId()));
                    ThreeWayMatch latestMatch = threeWayMatchRepository
                            .findLatestByInvoiceId(invoice.getId())
                            .orElse(null);
                    return new ExceptionQueueItem(invoice, approval, latestMatch);
                })
                .filter(item -> item.invoice().getStatus() == InvoiceStatus.EXCEPTION)
                .toList();
    }

    @Transactional
    public PaymentApproval resolve(UUID invoiceId, PaymentDecision decision, String approvedBy) {
        PaymentApproval approval = paymentApprovalRepository
                .findPendingReviewByInvoiceId(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Pending payment approval not found for invoice: " + invoiceId));

        Invoice invoice = invoiceRepository
                .findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
        if (invoice.getStatus() != InvoiceStatus.EXCEPTION) {
            throw new InvalidStateException("Invoice " + invoiceId + " is " + invoice.getStatus() + ", not an exception");
        }

        PaymentStatus status =
                decision == PaymentDecision.APPROVE ? PaymentStatus.APPROVED_MANUAL : PaymentStatus.REJECTED;
        approval.resolve(status, approvedBy, OffsetDateTime.now());
        if (decision == PaymentDecision.APPROVE) {
            invoice.markApproved();
            invoiceRepository.save(invoice);
        }

        return paymentApprovalRepository.save(approval);
    }

    public record ExceptionQueueItem(Invoice invoice, PaymentApproval paymentApproval, ThreeWayMatch latestMatch) {
    }
}
