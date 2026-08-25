package com.chainvision.pr2.dto;

import com.chainvision.pr2.payment.PaymentApproval;
import com.chainvision.pr2.payment.PaymentStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PaymentApprovalResponse(
        UUID id, UUID invoiceId, PaymentStatus status, String approvedBy, OffsetDateTime approvedAt) {

    public static PaymentApprovalResponse from(PaymentApproval approval) {
        return new PaymentApprovalResponse(
                approval.getId(), approval.getInvoiceId(), approval.getStatus(), approval.getApprovedBy(), approval.getApprovedAt());
    }
}
