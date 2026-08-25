package com.chainvision.pr2.sourcing;

import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.exception.BusinessRuleViolationException;
import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

// Deterministic supplier selection — Documentaion/00_PROJECT_CONTEXT.md Section 3 ("Sourcing &
// PO") and Section 5.1's hard rule: this must never be an LLM decision. Suppliers are first
// filtered to those with enough capacity for the requisition, then ranked by a weighted,
// min-max-normalized score over price (lower is better), lead time (lower is better), on-time
// delivery, and quality. Weights are configurable (pr2.supplier-scoring.weights.*) and default to
// price 0.35 / lead-time 0.15 / OTD 0.25 / quality 0.25, reflecting the project brief's emphasis
// on price and performance (Section 3, "price, lead time, capacity, and performance score").
@Service
public class SupplierScoringEngine {

    private final SupplierRepository supplierRepository;
    private final BigDecimal priceWeight;
    private final BigDecimal leadTimeWeight;
    private final BigDecimal otdWeight;
    private final BigDecimal qualityWeight;

    public SupplierScoringEngine(
            SupplierRepository supplierRepository,
            @Value("${pr2.supplier-scoring.weights.price:0.35}") BigDecimal priceWeight,
            @Value("${pr2.supplier-scoring.weights.lead-time:0.15}") BigDecimal leadTimeWeight,
            @Value("${pr2.supplier-scoring.weights.otd:0.25}") BigDecimal otdWeight,
            @Value("${pr2.supplier-scoring.weights.quality:0.25}") BigDecimal qualityWeight) {
        this.supplierRepository = supplierRepository;
        this.priceWeight = priceWeight;
        this.leadTimeWeight = leadTimeWeight;
        this.otdWeight = otdWeight;
        this.qualityWeight = qualityWeight;
    }

    public List<SupplierScoreResult> rankEligibleSuppliers(int requiredCapacity) {
        List<Supplier> eligible = supplierRepository.findAll().stream()
                .filter(s -> s.getCapacityUnits() >= requiredCapacity)
                .toList();
        if (eligible.isEmpty()) {
            throw new BusinessRuleViolationException(
                    "No supplier has sufficient capacity (" + requiredCapacity + " units required)");
        }

        BigDecimal minPrice = min(eligible, Supplier::getPriceIndex);
        BigDecimal maxPrice = max(eligible, Supplier::getPriceIndex);
        BigDecimal minLeadTime = eligible.stream()
                .map(s -> BigDecimal.valueOf(s.getAvgLeadTimeDays()))
                .min(BigDecimal::compareTo)
                .orElseThrow();
        BigDecimal maxLeadTime = eligible.stream()
                .map(s -> BigDecimal.valueOf(s.getAvgLeadTimeDays()))
                .max(BigDecimal::compareTo)
                .orElseThrow();
        BigDecimal minOtd = min(eligible, Supplier::getOtdScore);
        BigDecimal maxOtd = max(eligible, Supplier::getOtdScore);
        BigDecimal minQuality = min(eligible, Supplier::getQualityScore);
        BigDecimal maxQuality = max(eligible, Supplier::getQualityScore);

        return eligible.stream()
                .map(supplier -> {
                    BigDecimal normPrice =
                            normalizeInverted(supplier.getPriceIndex(), minPrice, maxPrice);
                    BigDecimal normLeadTime = normalizeInverted(
                            BigDecimal.valueOf(supplier.getAvgLeadTimeDays()), minLeadTime, maxLeadTime);
                    BigDecimal normOtd = normalize(supplier.getOtdScore(), minOtd, maxOtd);
                    BigDecimal normQuality = normalize(supplier.getQualityScore(), minQuality, maxQuality);

                    BigDecimal score = normPrice
                            .multiply(priceWeight)
                            .add(normLeadTime.multiply(leadTimeWeight))
                            .add(normOtd.multiply(otdWeight))
                            .add(normQuality.multiply(qualityWeight));

                    return new SupplierScoreResult(
                            supplier.getId(), supplier.getName(), score.setScale(4, java.math.RoundingMode.HALF_UP), supplier);
                })
                .sorted(Comparator.comparing(SupplierScoreResult::score).reversed())
                .toList();
    }

    public SupplierScoreResult selectBestSupplier(int requiredCapacity) {
        return rankEligibleSuppliers(requiredCapacity).get(0);
    }

    private static BigDecimal min(List<Supplier> suppliers, java.util.function.Function<Supplier, BigDecimal> f) {
        return suppliers.stream().map(f).min(BigDecimal::compareTo).orElseThrow();
    }

    private static BigDecimal max(List<Supplier> suppliers, java.util.function.Function<Supplier, BigDecimal> f) {
        return suppliers.stream().map(f).max(BigDecimal::compareTo).orElseThrow();
    }

    // Higher raw value -> higher normalized value (e.g. OTD/quality scores).
    private static BigDecimal normalize(BigDecimal value, BigDecimal min, BigDecimal max) {
        if (max.compareTo(min) == 0) {
            return BigDecimal.ONE;
        }
        return value.subtract(min).divide(max.subtract(min), MathContext.DECIMAL64);
    }

    // Lower raw value -> higher normalized value (e.g. price, lead time).
    private static BigDecimal normalizeInverted(BigDecimal value, BigDecimal min, BigDecimal max) {
        if (max.compareTo(min) == 0) {
            return BigDecimal.ONE;
        }
        return max.subtract(value).divide(max.subtract(min), MathContext.DECIMAL64);
    }
}
