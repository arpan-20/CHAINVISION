package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.Supplier;
import java.math.BigDecimal;
import java.util.UUID;

public record SupplierResponse(
        UUID id,
        String name,
        BigDecimal priceIndex,
        Integer avgLeadTimeDays,
        BigDecimal otdScore,
        BigDecimal qualityScore,
        Integer capacityUnits) {

    public static SupplierResponse from(Supplier supplier) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getPriceIndex(),
                supplier.getAvgLeadTimeDays(),
                supplier.getOtdScore(),
                supplier.getQualityScore(),
                supplier.getCapacityUnits());
    }
}
