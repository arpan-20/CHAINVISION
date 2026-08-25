package com.chainvision.pr2.service;

import com.chainvision.pr2.entity.PaymentApproval;
import com.chainvision.pr2.entity.PaymentStatus;
import com.chainvision.pr2.entity.ThreeWayMatch;
import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.repository.PaymentApprovalRepository;
import com.chainvision.pr2.repository.ThreeWayMatchRepository;
import com.chainvision.pr2.dto.ResolutionAction;
import com.chainvision.pr2.invoice.Invoice;
import com.chainvision.pr2.invoice.InvoiceRepository;
import com.chainvision.pr2.invoice.InvoiceStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The exception queue (Documentaion/00_PROJECT_CONTEXT.md Section 3, "On mismatch → route to
// Exception Queue for human review"). There's no separate `exceptions` table in the schema
// (Section 7.2) — an "exception" is simply an invoice in EXCEPTION status that doesn't yet have a
// resolving PaymentApproval. Resolving one (approve/reject) records that decision, which is what
// removes it from the active list — see MatchingService for how an invoice gets into EXCEPTION
// in the first place.
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

    public List<Invoice> listActiveExceptions() {
        return invoiceRepository.findByStatus(InvoiceStatus.EXCEPTION).stream()
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

        if (invoice.getStatus() != InvoiceStatus.EXCEPTION) {
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
