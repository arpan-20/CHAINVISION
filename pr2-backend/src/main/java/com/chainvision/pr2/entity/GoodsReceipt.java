package com.chainvision.pr2.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

// Mirrors pr2.goods_receipts — see Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "goods_receipts", schema = "pr2")
public class GoodsReceipt {

    @Id
    private UUID id;

    @Column(name = "po_id", nullable = false)
    private UUID poId;

    @Column(name = "received_qty", nullable = false)
    private Integer receivedQty;

    @Column(name = "batch_no")
    private String batchNo;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt;

    protected GoodsReceipt() {
        // JPA
    }

    public GoodsReceipt(UUID poId, Integer receivedQty, String batchNo, LocalDate expiryDate) {
        this.id = UUID.randomUUID();
        this.poId = poId;
        this.receivedQty = receivedQty;
        this.batchNo = batchNo;
        this.expiryDate = expiryDate;
        this.receivedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getPoId() {
        return poId;
    }

    public Integer getReceivedQty() {
        return receivedQty;
    }

    public String getBatchNo() {
        return batchNo;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public OffsetDateTime getReceivedAt() {
        return receivedAt;
    }
}
