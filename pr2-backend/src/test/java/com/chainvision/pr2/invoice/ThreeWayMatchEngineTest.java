package com.chainvision.pr2.invoice;

import static org.assertj.core.api.Assertions.assertThat;

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
