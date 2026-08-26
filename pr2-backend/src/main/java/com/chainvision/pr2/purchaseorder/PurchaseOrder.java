package com.chainvision.pr2.purchaseorder;

import com.chainvision.pr2.entity.PurchaseOrderStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

// Mirrors pr2.purchase_orders — see Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "purchase_orders", schema = "pr2")
public class PurchaseOrder {

    @Id
    private UUID id;

    @Column(name = "requisition_id", nullable = false)
    private UUID requisitionId;

    @Column(name = "supplier_id", nullable = false)
    private UUID supplierId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private PurchaseOrderStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected PurchaseOrder() {
        // JPA
    }

    public PurchaseOrder(UUID requisitionId, UUID supplierId, Integer quantity, BigDecimal unitPrice) {
        this.id = UUID.randomUUID();
        this.requisitionId = requisitionId;
        this.supplierId = supplierId;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.totalAmount = unitPrice.multiply(BigDecimal.valueOf(quantity));
        this.status = PurchaseOrderStatus.ISSUED;
        this.createdAt = OffsetDateTime.now();
    }

    public void markPartiallyReceived() {
        this.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    public void markReceived() {
        this.status = PurchaseOrderStatus.RECEIVED;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRequisitionId() {
        return requisitionId;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public PurchaseOrderStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
