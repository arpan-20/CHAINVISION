package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.PaymentApproval;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentApprovalRepository extends JpaRepository<PaymentApproval, UUID> {

    List<PaymentApproval> findByInvoiceId(UUID invoiceId);
}
