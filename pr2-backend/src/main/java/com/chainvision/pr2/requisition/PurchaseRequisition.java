package com.chainvision.pr2.requisition;

import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.entity.Urgency;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

// Mirrors pr2.purchase_requisitions — see Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "purchase_requisitions", schema = "pr2")
public class PurchaseRequisition {

    @Id
    private UUID id;

    @Column(name = "recommendation_id")
    private String recommendationId;

    @Column(name = "sku_code", nullable = false)
    private String skuCode;

    @Column(name = "dc_code", nullable = false)
    private String dcCode;

    @Column(nullable = false)
    private Integer quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Urgency urgency;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private RequisitionSource source;

    @Column(name = "raw_nl_input")
    private String rawNlInput;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private RequisitionStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected PurchaseRequisition() {
        // JPA
    }

    public void markSourced() {
        this.status = RequisitionStatus.SOURCED;
    }

    public void markPoRaised() {
        this.status = RequisitionStatus.PO_RAISED;
    }

    public PurchaseRequisition(
            String recommendationId,
            String skuCode,
            String dcCode,
            Integer quantity,
            Urgency urgency,
            RequisitionSource source,
            String rawNlInput) {
        this.id = UUID.randomUUID();
        this.recommendationId = recommendationId;
        this.skuCode = skuCode;
        this.dcCode = dcCode;
        this.quantity = quantity;
        this.urgency = urgency;
        this.source = source;
        this.rawNlInput = rawNlInput;
        this.status = RequisitionStatus.CREATED;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public String getRecommendationId() {
        return recommendationId;
    }

    public String getSkuCode() {
        return skuCode;
    }

    public String getDcCode() {
        return dcCode;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public Urgency getUrgency() {
        return urgency;
    }

    public RequisitionSource getSource() {
        return source;
    }

    public String getRawNlInput() {
        return rawNlInput;
    }

    public RequisitionStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
