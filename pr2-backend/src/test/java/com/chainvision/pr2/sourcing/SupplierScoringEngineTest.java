package com.chainvision.pr2.sourcing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.exception.BusinessRuleViolationException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class SupplierScoringEngineTest {

    private final SupplierRepository supplierRepository = Mockito.mock(SupplierRepository.class);

    private final SupplierScoringEngine scoringEngine = new SupplierScoringEngine(
            supplierRepository,
            new BigDecimal("0.35"),
            new BigDecimal("0.15"),
            new BigDecimal("0.25"),
            new BigDecimal("0.25"));

    @Test
    void ranksReliableSupplierAboveCheapButUnreliableSupplier() {
        Supplier cheapButUnreliable = supplier(
                "Cheap but unreliable",
                "0.80",
                18,
                "0.62",
                "0.70",
                12_000);
        Supplier balanced = supplier(
                "Balanced supplier",
                "1.00",
                10,
                "0.86",
                "0.88",
                12_000);
        Supplier expensiveHighPerforming = supplier(
                "Expensive high-performing",
                "1.18",
                4,
                "0.98",
                "0.99",
                12_000);

        when(supplierRepository.findAll())
                .thenReturn(List.of(cheapButUnreliable, balanced, expensiveHighPerforming));

        List<SupplierScoreResult> ranking = scoringEngine.rankEligibleSuppliers(5_000);

        assertThat(ranking).extracting(SupplierScoreResult::supplierName)
                .containsExactly("Expensive high-performing", "Balanced supplier", "Cheap but unreliable");
        assertThat(ranking.get(0).score()).isGreaterThan(ranking.get(2).score());
    }

    @Test
    void filtersOutSuppliersBelowRequiredCapacityBeforeScoring() {
        Supplier insufficientCapacity = supplier(
                "Strong but too small",
                "0.75",
                3,
                "0.99",
                "0.99",
                2_000);
        Supplier eligibleSupplier = supplier(
                "Eligible supplier",
                "1.05",
                8,
                "0.90",
                "0.92",
                8_000);

        when(supplierRepository.findAll()).thenReturn(List.of(insufficientCapacity, eligibleSupplier));

        List<SupplierScoreResult> ranking = scoringEngine.rankEligibleSuppliers(5_000);

        assertThat(ranking).singleElement()
                .extracting(SupplierScoreResult::supplierName)
                .isEqualTo("Eligible supplier");
    }

    @Test
    void rejectsWhenNoSupplierCanMeetRequiredCapacity() {
        when(supplierRepository.findAll())
                .thenReturn(List.of(supplier("Too small", "0.90", 5, "0.95", "0.95", 1_000)));

        assertThatThrownBy(() -> scoringEngine.rankEligibleSuppliers(5_000))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("No supplier has sufficient capacity");
    }

    private static Supplier supplier(
            String name,
            String priceIndex,
            int avgLeadTimeDays,
            String otdScore,
            String qualityScore,
            int capacityUnits) {
        Supplier supplier = newSupplier();
        ReflectionTestUtils.setField(supplier, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(supplier, "name", name);
        ReflectionTestUtils.setField(supplier, "priceIndex", new BigDecimal(priceIndex));
        ReflectionTestUtils.setField(supplier, "avgLeadTimeDays", avgLeadTimeDays);
        ReflectionTestUtils.setField(supplier, "otdScore", new BigDecimal(otdScore));
        ReflectionTestUtils.setField(supplier, "qualityScore", new BigDecimal(qualityScore));
        ReflectionTestUtils.setField(supplier, "capacityUnits", capacityUnits);
        return supplier;
    }

    private static Supplier newSupplier() {
        try {
            var constructor = Supplier.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Unable to instantiate Supplier for scoring test", ex);
        }
    }
}
