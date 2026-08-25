package com.chainvision.pr2.invoice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

// Mirrors pr2.three_way_matches, Documentaion/00_PROJECT_CONTEXT.md Section 7.2.
@Entity
@Table(name = "three_way_matches", schema = "pr2")
public class ThreeWayMatch {

    @Id
    private UUID id;

    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Column(name = "po_id", nullable = false)
    private UUID poId;

    @Column(name = "grn_id")
    private UUID grnId;

    @Column(name = "qty_match", nullable = false)
    private boolean qtyMatch;

    @Column(name = "price_match", nullable = false)
    private boolean priceMatch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MatchResult result;

    @Column(name = "mismatch_reason")
    private String mismatchReason;

    @Column(name = "ai_explanation")
    private String aiExplanation;

    @Column(name = "matched_at", nullable = false)
    private OffsetDateTime matchedAt;

    protected ThreeWayMatch() {
        // JPA
    }

    public ThreeWayMatch(
            UUID invoiceId,
            UUID poId,
            UUID grnId,
            boolean qtyMatch,
            boolean priceMatch,
            MatchResult result,
            String mismatchReason,
            String aiExplanation) {
        this.id = UUID.randomUUID();
        this.invoiceId = invoiceId;
        this.poId = poId;
        this.grnId = grnId;
        this.qtyMatch = qtyMatch;
        this.priceMatch = priceMatch;
        this.result = result;
        this.mismatchReason = mismatchReason;
        this.aiExplanation = aiExplanation;
        this.matchedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public UUID getPoId() {
        return poId;
    }

    public UUID getGrnId() {
        return grnId;
    }

    public boolean isQtyMatch() {
        return qtyMatch;
    }

    public boolean isPriceMatch() {
        return priceMatch;
    }

    public MatchResult getResult() {
        return result;
    }

    public String getMismatchReason() {
        return mismatchReason;
    }

    public String getAiExplanation() {
        return aiExplanation;
    }

    public OffsetDateTime getMatchedAt() {
        return matchedAt;
    }
}
