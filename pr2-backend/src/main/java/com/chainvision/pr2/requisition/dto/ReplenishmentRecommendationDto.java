package com.chainvision.pr2.requisition.dto;

import com.chainvision.pr2.entity.Urgency;
import java.math.BigDecimal;

/** P1 replenishment handoff contract mirrored from shared/contracts. */
public record ReplenishmentRecommendationDto(
        String recommendationId,
        String skuId,
        String skuName,
        String dcId,
        BigDecimal recommendedQty,
        Urgency urgency,
        String reason,
        String aiRationale,
        String expiryRiskContext,
        String generatedAt) {
}