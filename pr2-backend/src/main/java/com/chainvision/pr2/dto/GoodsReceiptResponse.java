package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.GoodsReceipt;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record GoodsReceiptResponse(
        UUID id, UUID poId, Integer receivedQty, String batchNo, LocalDate expiryDate, OffsetDateTime receivedAt) {

    public static GoodsReceiptResponse from(GoodsReceipt grn) {
        return new GoodsReceiptResponse(
                grn.getId(), grn.getPoId(), grn.getReceivedQty(), grn.getBatchNo(), grn.getExpiryDate(), grn.getReceivedAt());
    }
}
