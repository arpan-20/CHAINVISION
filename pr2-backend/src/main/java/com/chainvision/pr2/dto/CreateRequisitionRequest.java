package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.Urgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

// Request body for POST /api/requisitions (manual/chatbot-derived creation).
// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
public record CreateRequisitionRequest(
        @NotBlank String skuCode,
        @NotBlank String dcCode,
        @NotNull @Positive Integer quantity,
        @NotNull Urgency urgency,
        String rawNlInput) {
}
