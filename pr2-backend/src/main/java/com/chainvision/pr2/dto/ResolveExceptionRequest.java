package com.chainvision.pr2.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ResolveExceptionRequest(@NotNull ResolutionAction action, @NotBlank String resolvedBy) {
}
