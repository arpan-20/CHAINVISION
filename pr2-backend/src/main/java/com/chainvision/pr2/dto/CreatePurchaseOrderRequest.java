package com.chainvision.pr2.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

// unitPrice is supplied by the caller (procurement officer / catalog lookup upstream) rather
// than computed here — PR2's schema (Section 7.2) has no SKU price catalog of its own, and price
// negotiation/contracting is out of this backend's scope.
public record CreatePurchaseOrderRequest(@NotNull @Positive BigDecimal unitPrice) {
}
