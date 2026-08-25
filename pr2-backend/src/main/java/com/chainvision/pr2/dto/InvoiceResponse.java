package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.Invoice;
import com.chainvision.pr2.entity.InvoiceStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record InvoiceResponse(
        UUID id,
        UUID poId,
        String invoiceNumber,
        String vendorNameOcr,
        Integer quantityOcr,
        BigDecimal unitPriceOcr,
        BigDecimal totalOcr,
        String uploadedFileRef,
        InvoiceStatus status,
        OffsetDateTime createdAt) {

    public static InvoiceResponse from(Invoice invoice) {
        return new InvoiceResponse(
                invoice.getId(),
                invoice.getPoId(),
                invoice.getInvoiceNumber(),
                invoice.getVendorNameOcr(),
                invoice.getQuantityOcr(),
                invoice.getUnitPriceOcr(),
                invoice.getTotalOcr(),
                invoice.getUploadedFileRef(),
                invoice.getStatus(),
                invoice.getCreatedAt());
    }
}
