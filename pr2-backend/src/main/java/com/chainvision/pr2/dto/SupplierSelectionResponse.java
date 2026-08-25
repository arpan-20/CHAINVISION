package com.chainvision.pr2.dto;

import java.math.BigDecimal;
import java.util.List;

public record SupplierSelectionResponse(SupplierResponse selected, BigDecimal score, List<ScoredSupplier> ranking) {

    public record ScoredSupplier(SupplierResponse supplier, BigDecimal score) {
    }
}
