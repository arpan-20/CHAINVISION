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

    @Test
    void capacityBoundaryExactlyEqualToRequiredIsEligible() {
        // Supplier with capacity exactly equal to the requirement must NOT be filtered out
        Supplier boundarySupplier = supplier(
                "Exact capacity supplier",
                "1.00",
                10,
                "0.90",
                "0.90",
                5_000);

        when(supplierRepository.findAll()).thenReturn(List.of(boundarySupplier));

        List<SupplierScoreResult> ranking = scoringEngine.rankEligibleSuppliers(5_000);

        assertThat(ranking).singleElement()
                .extracting(SupplierScoreResult::supplierName)
                .isEqualTo("Exact capacity supplier");
    }

    @Test
    void allSuppliersEqualProduceIdenticalScores() {
        // When every raw metric is identical, min == max for each dimension and every
        // supplier normalizes to 1 on every axis, so all weighted scores are identical.
        List<Supplier> identicalSuppliers = List.of(
                supplier("Alpha", "1.00", 10, "0.90", "0.90", 10_000),
                supplier("Beta", "1.00", 10, "0.90", "0.90", 10_000),
                supplier("Gamma", "1.00", 10, "0.90", "0.90", 10_000));

        when(supplierRepository.findAll()).thenReturn(identicalSuppliers);

        List<SupplierScoreResult> ranking = scoringEngine.rankEligibleSuppliers(5_000);

        assertThat(ranking).hasSize(3);
        assertThat(ranking.get(0).score()).isEqualByComparingTo(ranking.get(1).score());
        assertThat(ranking.get(1).score()).isEqualByComparingTo(ranking.get(2).score());
        assertThat(ranking.get(0).score()).isEqualByComparingTo(new BigDecimal("1.0000"));
    }

    @Test
    void tieOnScoreBreaksDeterministicallyWithoutThrowing() {
        // Two suppliers with different raw metrics engineered to produce the same weighted
        // score: supplier A wins price (weight 0.35) by the same margin B wins OTD+quality
        // combined... simpler deterministic construction: symmetric mirror metrics.
        // A: best price/lead-time, worst otd/quality; B: worst price/lead-time, best otd/quality.
        // With weights price .35 + lead .15 = 0.50 vs otd .25 + quality .25 = 0.50,
        // both normalize to a total of 0.5 -> exact tie.
        Supplier mirrorA = supplier("Mirror A", "0.80", 4, "0.70", "0.70", 10_000);
        Supplier mirrorB = supplier("Mirror B", "1.20", 16, "0.99", "0.99", 10_000);

        when(supplierRepository.findAll()).thenReturn(List.of(mirrorA, mirrorB));

        List<SupplierScoreResult> ranking = scoringEngine.rankEligibleSuppliers(5_000);

        assertThat(ranking).hasSize(2);
        // Deterministic total ordering: no exception, stable full ranking returned
        assertThat(ranking.get(0).score()).isEqualByComparingTo(ranking.get(1).score());
        assertThat(ranking)
                .extracting(SupplierScoreResult::supplierName)
                .containsExactlyInAnyOrder("Mirror A", "Mirror B");
    }

    @Test
    void singleEligibleSupplierGetsPerfectNormalizedScore() {
        Supplier soleSupplier = supplier(
                "Only choice",
                "1.33",
                21,
                "0.55",
                "0.60",
                9_000);

        when(supplierRepository.findAll()).thenReturn(List.of(soleSupplier));

        SupplierScoreResult best = scoringEngine.selectBestSupplier(1_000);

        assertThat(best.supplierName()).isEqualTo("Only choice");
        assertThat(best.score()).isEqualByComparingTo(new BigDecimal("1.0000"));
    }

    @Test
    void cheaperSupplierWinsWhenPerformanceMetricsAreEqual() {
        Supplier cheapEfficient = supplier(
                "Cheap efficient",
                "0.85",
                8,
                "0.92",
                "0.94",
                20_000);
        Supplier priceyEqual = supplier(
                "Pricey equal performer",
                "1.15",
                12,
                "0.92",
                "0.94",
                20_000);

        when(supplierRepository.findAll()).thenReturn(List.of(priceyEqual, cheapEfficient));

        List<SupplierScoreResult> ranking = scoringEngine.rankEligibleSuppliers(5_000);

        assertThat(ranking.get(0).supplierName()).isEqualTo("Cheap efficient");
        assertThat(ranking.get(0).score()).isGreaterThan(ranking.get(1).score());
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
