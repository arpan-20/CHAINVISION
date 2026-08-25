package com.chainvision.pr2.invoice;

import com.chainvision.pr2.goodsreceipt.GoodsReceipt;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import java.math.BigDecimal;
import java.math.RoundingMode;

// Pure deterministic engine for Phase 17. It has no Spring, persistence, or Gemini dependency:
// quantity and price are compared against a documented 2% default tolerance.
public class ThreeWayMatchEngine {

    private static final BigDecimal DEFAULT_TOLERANCE_PCT = BigDecimal.valueOf(2);

    private final BigDecimal quantityTolerancePct;
    private final BigDecimal priceTolerancePct;

    public ThreeWayMatchEngine() {
        this(DEFAULT_TOLERANCE_PCT, DEFAULT_TOLERANCE_PCT);
    }

    public ThreeWayMatchEngine(BigDecimal quantityTolerancePct, BigDecimal priceTolerancePct) {
        this.quantityTolerancePct = quantityTolerancePct;
        this.priceTolerancePct = priceTolerancePct;
    }

    public MatchDecision match(PurchaseOrder po, GoodsReceipt grn, Invoice invoice) {
        return match(po, grn.getReceivedQty(), invoice);
    }

    public MatchDecision match(PurchaseOrder po, int receivedQuantity, Invoice invoice) {
        boolean invoiceMatchesReceipt = withinTolerance(
                BigDecimal.valueOf(invoice.getQuantityOcr()), BigDecimal.valueOf(receivedQuantity), quantityTolerancePct);
        boolean receiptMatchesPo = withinTolerance(
                BigDecimal.valueOf(receivedQuantity), BigDecimal.valueOf(po.getQuantity()), quantityTolerancePct);
        boolean qtyMatch = invoiceMatchesReceipt && receiptMatchesPo;
        boolean priceMatch = withinTolerance(invoice.getUnitPriceOcr(), po.getUnitPrice(), priceTolerancePct);
        MatchResult result = (qtyMatch && priceMatch) ? MatchResult.MATCHED : MatchResult.MISMATCHED;
        String mismatchReason = result == MatchResult.MISMATCHED
                ? buildMismatchReason(invoice, receivedQuantity, po, invoiceMatchesReceipt, receiptMatchesPo, priceMatch)
                : null;
        return new MatchDecision(qtyMatch, priceMatch, result, mismatchReason);
    }

    private boolean withinTolerance(BigDecimal actual, BigDecimal expected, BigDecimal tolerancePct) {
        if (expected.compareTo(BigDecimal.ZERO) == 0) {
            return actual.compareTo(BigDecimal.ZERO) == 0;
        }
        BigDecimal diffPct = actual.subtract(expected)
                .abs()
                .divide(expected, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
        return diffPct.compareTo(tolerancePct) <= 0;
    }

    private String buildMismatchReason(
            Invoice invoice,
            int receivedQuantity,
            PurchaseOrder po,
            boolean invoiceMatchesReceipt,
            boolean receiptMatchesPo,
            boolean priceMatch) {
        StringBuilder reason = new StringBuilder();
        if (!invoiceMatchesReceipt) {
            reason.append("Invoice quantity (%d) does not match goods received (%d); exceeds %s%% tolerance."
                    .formatted(invoice.getQuantityOcr(), receivedQuantity, quantityTolerancePct));
        }
        if (!receiptMatchesPo) {
            if (!reason.isEmpty()) {
                reason.append(' ');
            }
            reason.append("Goods received quantity (%d) does not match PO quantity (%d); exceeds %s%% tolerance."
                    .formatted(receivedQuantity, po.getQuantity(), quantityTolerancePct));
        }
        if (!priceMatch) {
            if (!reason.isEmpty()) {
                reason.append(' ');
            }
            reason.append(
                    "Invoice unit price (%s) does not match PO unit price (%s); exceeds %s%% tolerance."
                            .formatted(invoice.getUnitPriceOcr(), po.getUnitPrice(), priceTolerancePct));
        }
        return reason.toString();
    }

    public record MatchDecision(boolean qtyMatch, boolean priceMatch, MatchResult result, String mismatchReason) {
    }
}
