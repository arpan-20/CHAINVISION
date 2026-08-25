package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.PurchaseRequisition;
import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.entity.Urgency;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RequisitionResponse(
        UUID id,
        String recommendationId,
        String skuCode,
        String dcCode,
        Integer quantity,
        Urgency urgency,
        RequisitionSource source,
        String rawNlInput,
        RequisitionStatus status,
        OffsetDateTime createdAt) {

    public static RequisitionResponse from(PurchaseRequisition requisition) {
        return new RequisitionResponse(
                requisition.getId(),
                requisition.getRecommendationId(),
                requisition.getSkuCode(),
                requisition.getDcCode(),
                requisition.getQuantity(),
                requisition.getUrgency(),
                requisition.getSource(),
                requisition.getRawNlInput(),
                requisition.getStatus(),
                requisition.getCreatedAt());
    }
}
