package com.chainvision.pr2.entity;

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

// Mirrors pr2.invoices — see Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "invoices", schema = "pr2")
public class Invoice {

    @Id
    private UUID id;

    @Column(name = "po_id")
    private UUID poId;

    @Column(name = "invoice_number")
    private String invoiceNumber;

    @Column(name = "vendor_name_ocr")
    private String vendorNameOcr;

    @Column(name = "quantity_ocr")
    private Integer quantityOcr;

    @Column(name = "unit_price_ocr")
    private BigDecimal unitPriceOcr;

    @Column(name = "total_ocr")
    private BigDecimal totalOcr;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_ocr_json")
    private String rawOcrJson;

    @Column(name = "uploaded_file_ref")
    private String uploadedFileRef;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvoiceStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected Invoice() {
        // JPA
    }

    public Invoice(
            UUID poId,
            String invoiceNumber,
            String vendorNameOcr,
            Integer quantityOcr,
            BigDecimal unitPriceOcr,
            BigDecimal totalOcr,
            String rawOcrJson,
            String uploadedFileRef) {
        this.id = UUID.randomUUID();
        this.poId = poId;
        this.invoiceNumber = invoiceNumber;
        this.vendorNameOcr = vendorNameOcr;
        this.quantityOcr = quantityOcr;
        this.unitPriceOcr = unitPriceOcr;
        this.totalOcr = totalOcr;
        this.rawOcrJson = rawOcrJson;
        this.uploadedFileRef = uploadedFileRef;
        this.status = InvoiceStatus.PENDING_MATCH;
        this.createdAt = OffsetDateTime.now();
    }

    public void markMatched() {
        this.status = InvoiceStatus.MATCHED;
    }

    public void markException() {
        this.status = InvoiceStatus.EXCEPTION;
    }

    public void markApproved() {
        this.status = InvoiceStatus.APPROVED;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPoId() {
        return poId;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public String getVendorNameOcr() {
        return vendorNameOcr;
    }

    public Integer getQuantityOcr() {
        return quantityOcr;
    }

    public BigDecimal getUnitPriceOcr() {
        return unitPriceOcr;
    }

    public BigDecimal getTotalOcr() {
        return totalOcr;
    }

    public String getRawOcrJson() {
        return rawOcrJson;
    }

    public String getUploadedFileRef() {
        return uploadedFileRef;
    }

    public InvoiceStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
