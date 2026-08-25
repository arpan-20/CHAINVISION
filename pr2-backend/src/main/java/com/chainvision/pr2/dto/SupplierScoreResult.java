package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.Supplier;
import java.math.BigDecimal;
import java.util.UUID;

public record SupplierScoreResult(UUID supplierId, String supplierName, BigDecimal score, Supplier supplier) {
}
