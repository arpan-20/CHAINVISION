package com.chainvision.pr2.service;

import com.chainvision.pr2.entity.PaymentApproval;
import com.chainvision.pr2.entity.PaymentStatus;
import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.dto.ResolutionAction;
import com.chainvision.pr2.invoice.Invoice;
import com.chainvision.pr2.invoice.InvoiceRepository;
import com.chainvision.pr2.invoice.InvoiceStatus;
import com.chainvision.pr2.invoice.ThreeWayMatch;
import com.chainvision.pr2.invoice.ThreeWayMatchRepository;
import com.chainvision.pr2.repository.PaymentApprovalRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The exception queue (Documentaion/00_PROJECT_CONTEXT.md Section 3, "On mismatch → route to
// Exception Queue for human review"). There's no separate `exceptions` table in the schema
// (Section 7.2) — an active exception is a MISMATCHED/EXCEPTION invoice that doesn't yet have a
// resolving PaymentApproval.
@Service
public class ExceptionService {

    private final InvoiceRepository invoiceRepository;
    private final PaymentApprovalRepository paymentApprovalRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;

    public ExceptionService(
            InvoiceRepository invoiceRepository,
            PaymentApprovalRepository paymentApprovalRepository,
            ThreeWayMatchRepository threeWayMatchRepository) {
        this.invoiceRepository = invoiceRepository;
        this.paymentApprovalRepository = paymentApprovalRepository;
        this.threeWayMatchRepository = threeWayMatchRepository;
    }

    private List<Invoice> activeExceptionCandidates() {
        List<Invoice> exceptionInvoices = invoiceRepository.findByStatus(InvoiceStatus.EXCEPTION);
        List<Invoice> mismatchedInvoices = invoiceRepository.findByStatus(InvoiceStatus.MISMATCHED);
        return java.util.stream.Stream.concat(exceptionInvoices.stream(), mismatchedInvoices.stream())
                .toList();
    }

    public List<Invoice> listActiveExceptions() {
        return activeExceptionCandidates().stream()
                .filter(invoice -> paymentApprovalRepository.findByInvoiceId(invoice.getId()).isEmpty())
                .toList();
    }

    public ThreeWayMatch latestMatchFor(UUID invoiceId) {
        return threeWayMatchRepository.findLatestByInvoiceId(invoiceId).orElse(null);
    }

    @Transactional
    public PaymentApproval resolve(UUID invoiceId, ResolutionAction action, String resolvedBy) {
        Invoice invoice = invoiceRepository
                .findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));

        if (invoice.getStatus() != InvoiceStatus.EXCEPTION && invoice.getStatus() != InvoiceStatus.MISMATCHED) {
            throw new InvalidStateException("Invoice " + invoiceId + " is " + invoice.getStatus() + ", not an open exception");
        }
        if (!paymentApprovalRepository.findByInvoiceId(invoiceId).isEmpty()) {
            throw new InvalidStateException("Invoice " + invoiceId + " has already been resolved");
        }

        PaymentStatus status = action == ResolutionAction.APPROVE ? PaymentStatus.APPROVED_MANUAL : PaymentStatus.REJECTED;
        PaymentApproval approval =
                paymentApprovalRepository.save(new PaymentApproval(invoiceId, status, resolvedBy, OffsetDateTime.now()));

        if (action == ResolutionAction.APPROVE) {
            invoice.markApproved();
            invoiceRepository.save(invoice);
        }

        return approval;
    }
}
