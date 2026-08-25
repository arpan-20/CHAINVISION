package com.chainvision.pr2.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

// Mirrors pr2.payment_approvals — see Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "payment_approvals", schema = "pr2")
public class PaymentApproval {

    @Id
    private UUID id;

    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    protected PaymentApproval() {
        // JPA
    }

    public PaymentApproval(UUID invoiceId, PaymentStatus status, String approvedBy, OffsetDateTime approvedAt) {
        this.id = UUID.randomUUID();
        this.invoiceId = invoiceId;
        this.status = status;
        this.approvedBy = approvedBy;
        this.approvedAt = approvedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public OffsetDateTime getApprovedAt() {
        return approvedAt;
    }
}
