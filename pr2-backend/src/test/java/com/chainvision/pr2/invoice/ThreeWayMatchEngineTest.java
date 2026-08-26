package com.chainvision.pr2.invoice;

import static org.assertj.core.api.Assertions.assertThat;

import com.chainvision.pr2.goodsreceipt.GoodsReceipt;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ThreeWayMatchEngineTest {

    private final ThreeWayMatchEngine engine =
            new ThreeWayMatchEngine(BigDecimal.valueOf(2), BigDecimal.valueOf(2));

    @Test
    void exactQuantityAndPriceMatch() {
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(1200, "10.325"), 1200, invoice(1200, "10.325", "12390.00"));

        assertThat(decision.qtyMatch()).isTrue();
        assertThat(decision.priceMatch()).isTrue();
        assertThat(decision.result()).isEqualTo(MatchResult.MATCHED);
        assertThat(decision.mismatchReason()).isNull();
    }

    @Test
    void quantityMismatchBeyondTolerance() {
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(900, "0.715"), 900, invoice(700, "0.715", "500.50"));

        assertThat(decision.qtyMatch()).isFalse();
        assertThat(decision.priceMatch()).isTrue();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
        assertThat(decision.mismatchReason())
                .contains("Invoice quantity (700)")
                .contains("goods received (900)")
                .contains("2% tolerance");
    }

    @Test
    void priceMismatchBeyondTolerance() {
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(650, "3.706"), 650, invoice(650, "4.25", "2762.50"));

        assertThat(decision.qtyMatch()).isTrue();
        assertThat(decision.priceMatch()).isFalse();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
        assertThat(decision.mismatchReason())
                .contains("Invoice unit price (4.25)")
                .contains("PO unit price (3.706)")
                .contains("2% tolerance");
    }

    @Test
    void bothQuantityAndPriceMismatchBeyondTolerance() {
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(900, "3.706"), 700, invoice(650, "4.25", "2762.50"));

        assertThat(decision.qtyMatch()).isFalse();
        assertThat(decision.priceMatch()).isFalse();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
        assertThat(decision.mismatchReason())
                .contains("Invoice quantity (650)")
                .contains("goods received (700)")
                .contains("Invoice unit price (4.25)")
                .contains("PO unit price (3.706)");
    }

    @Test
    void exactlyTwoPercentQuantityOffIsStillAMatch_boundary() {
        // 1020 vs 1000 received = exactly +2.0% diff -> within tolerance (<=)
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(1000, "5.00"), 1000, invoice(1020, "5.00", "5100.00"));

        assertThat(decision.qtyMatch()).isTrue();
        assertThat(decision.result()).isEqualTo(MatchResult.MATCHED);
        assertThat(decision.mismatchReason()).isNull();
    }

    @Test
    void justBeyondTwoPercentQuantityOffMismatched_boundary() {
        // 1021 vs 1000 = 2.1% -> outside tolerance
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(1000, "5.00"), 1000, invoice(1021, "5.00", "5105.00"));

        assertThat(decision.qtyMatch()).isFalse();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
    }

    @Test
    void exactlyTwoPercentPriceOffIsStillAMatch_boundary() {
        // 5.10 vs 5.00 = exactly 2% price diff -> within tolerance
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(500, "5.00"), 500, invoice(500, "5.10", "2550.00"));

        assertThat(decision.priceMatch()).isTrue();
        assertThat(decision.result()).isEqualTo(MatchResult.MATCHED);
    }

    @Test
    void justBeyondTwoPercentPriceOffMismatched_boundary() {
        // 5.11 vs 5.00 = 2.2% -> outside tolerance
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(500, "5.00"), 500, invoice(500, "5.11", "2555.00"));

        assertThat(decision.priceMatch()).isFalse();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
    }

    @Test
    void zeroInvoiceQuantityAgainstNonZeroReceivedMismatches() {
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(300, "2.00"), 300, invoice(0, "2.00", "0.00"));

        assertThat(decision.qtyMatch()).isFalse();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
        assertThat(decision.mismatchReason()).contains("Invoice quantity (0)");
    }

    @Test
    void allZeroQuantitiesMatchByDefinition() {
        // expected==0 branch: only matches when actual is also 0
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(po(0, "1.00"), 0, invoice(0, "1.00", "0.00"));

        assertThat(decision.qtyMatch()).isTrue();
        assertThat(decision.result()).isEqualTo(MatchResult.MATCHED);
    }

    @Test
    void grnOverReceiptPathDelegatesToReceivedQuantity() {
        PurchaseOrder order = po(500, "3.00");

        // GoodsReceipt-backed overload; short GRN of 480 vs PO 500 is 4% -> receipt-vs-PO fails
        Invoice shortInvoice = invoice(480, "3.00", "1440.00");
        ThreeWayMatchEngine.MatchDecision decision =
                engine.match(order, newGrn(480), shortInvoice);

        assertThat(decision.qtyMatch()).isFalse();
        assertThat(decision.result()).isEqualTo(MatchResult.MISMATCHED);
        assertThat(decision.mismatchReason())
                .contains("Goods received quantity (480)")
                .contains("PO quantity (500)");

        // Full GRN of 500 + consistent invoice -> clean match through the same overload
        Invoice fullInvoice = invoice(500, "3.00", "1500.00");
        ThreeWayMatchEngine.MatchDecision okDecision =
                engine.match(order, newGrn(500), fullInvoice);

        assertThat(okDecision.qtyMatch()).isTrue();
        assertThat(okDecision.result()).isEqualTo(MatchResult.MATCHED);
    }

    @Test
    void customToleranceConstructorIsHonored() {
        ThreeWayMatchEngine lenient = new ThreeWayMatchEngine(BigDecimal.valueOf(5), BigDecimal.valueOf(5));

        // 4% off would fail at default 2% but passes at 5%
        ThreeWayMatchEngine.MatchDecision decision =
                lenient.match(po(1000, "5.00"), 1000, invoice(1040, "5.00", "5200.00"));

        assertThat(decision.qtyMatch()).isTrue();
        assertThat(decision.result()).isEqualTo(MatchResult.MATCHED);
    }

    private static GoodsReceipt newGrn(int receivedQty) {
        return new GoodsReceipt(UUID.randomUUID(), receivedQty, "GRN-TEST", java.time.LocalDate.parse("2027-06-01"));
    }

    private static PurchaseOrder po(int quantity, String unitPrice) {
        return new PurchaseOrder(UUID.randomUUID(), UUID.randomUUID(), quantity, new BigDecimal(unitPrice));
    }

    private static Invoice invoice(int quantity, String unitPrice, String total) {
        return new Invoice(
                UUID.randomUUID(),
                "INV-TEST",
                "Test Vendor",
                quantity,
                new BigDecimal(unitPrice),
                new BigDecimal(total),
                "{}",
                "invoice.pdf");
    }
}
