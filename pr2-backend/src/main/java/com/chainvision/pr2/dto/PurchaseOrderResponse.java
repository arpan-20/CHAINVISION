package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.PurchaseOrderStatus;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PurchaseOrderResponse(
        UUID id,
        UUID requisitionId,
        UUID supplierId,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal totalAmount,
        PurchaseOrderStatus status,
        OffsetDateTime createdAt) {

    public static PurchaseOrderResponse from(PurchaseOrder po) {
        return new PurchaseOrderResponse(
                po.getId(),
                po.getRequisitionId(),
                po.getSupplierId(),
                po.getQuantity(),
                po.getUnitPrice(),
                po.getTotalAmount(),
                po.getStatus(),
                po.getCreatedAt());
    }
}
