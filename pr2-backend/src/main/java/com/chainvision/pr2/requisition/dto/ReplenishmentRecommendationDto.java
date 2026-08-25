package com.chainvision.pr2.requisition.dto;

import com.chainvision.pr2.entity.Urgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

// The P1 -> PR2 handoff contract — Documentaion/00_PROJECT_CONTEXT.md Section 4.
// skuName, reason, aiRationale, expiryRiskContext and generatedAt are accepted (P1 sends them)
// but not persisted — pr2.purchase_requisitions (Section 7.2) has no columns for them; they're
// context for the requisition-creation decision, not part of PR2's own record.
public record ReplenishmentRecommendationDto(
        @NotBlank String recommendationId,
        @NotBlank String skuId,
        String skuName,
        @NotBlank String dcId,
        @NotNull @Positive BigDecimal recommendedQty,
        @NotNull Urgency urgency,
        String reason,
        String aiRationale,
        String expiryRiskContext,
        String generatedAt) {
}
