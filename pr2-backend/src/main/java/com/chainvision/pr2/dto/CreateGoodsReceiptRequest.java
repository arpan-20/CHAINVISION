package com.chainvision.pr2.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.util.UUID;

public record CreateGoodsReceiptRequest(
        @NotNull UUID poId,
        @NotNull @Positive Integer receivedQty,
        @NotBlank String batchNo,
        @NotNull LocalDate expiryDate) {
}
