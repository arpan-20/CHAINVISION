package com.chainvision.pr2.dto;

import jakarta.validation.constraints.NotBlank;

public record ParseIntentRequest(@NotBlank String text) {
}
