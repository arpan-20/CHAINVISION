package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.RequisitionSource;
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
        String rawNlInput,
        RequisitionSource source) {

        public CreateRequisitionRequest(
                        String skuCode, String dcCode, Integer quantity, Urgency urgency, String rawNlInput) {
                this(skuCode, dcCode, quantity, urgency, rawNlInput, null);
        }
}
