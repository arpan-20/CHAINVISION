package com.chainvision.pr2.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

// Mirrors pr2.suppliers — see Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "suppliers", schema = "pr2")
public class Supplier {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "price_index", nullable = false)
    private BigDecimal priceIndex;

    @Column(name = "avg_lead_time_days", nullable = false)
    private Integer avgLeadTimeDays;

    @Column(name = "otd_score", nullable = false)
    private BigDecimal otdScore;

    @Column(name = "quality_score", nullable = false)
    private BigDecimal qualityScore;

    @Column(name = "capacity_units", nullable = false)
    private Integer capacityUnits;

    protected Supplier() {
        // JPA
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getPriceIndex() {
        return priceIndex;
    }

    public Integer getAvgLeadTimeDays() {
        return avgLeadTimeDays;
    }

    public BigDecimal getOtdScore() {
        return otdScore;
    }

    public BigDecimal getQualityScore() {
        return qualityScore;
    }

    public Integer getCapacityUnits() {
        return capacityUnits;
    }
}
