package com.chainvision.pr2.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ResolvePaymentApprovalRequest(@NotNull PaymentDecision decision, @NotBlank String approvedBy) {
}
