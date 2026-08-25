package com.chainvision.pr2.payment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentApprovalRepository extends JpaRepository<PaymentApproval, UUID> {

    List<PaymentApproval> findByInvoiceId(UUID invoiceId);

    List<PaymentApproval> findByStatus(PaymentStatus status);

    default Optional<PaymentApproval> findPendingReviewByInvoiceId(UUID invoiceId) {
        return findByInvoiceId(invoiceId).stream()
                .filter(approval -> approval.getStatus() == PaymentStatus.PENDING_REVIEW)
                .findFirst();
    }
}
