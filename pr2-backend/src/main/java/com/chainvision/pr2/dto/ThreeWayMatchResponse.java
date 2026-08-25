package com.chainvision.pr2.dto;

import com.chainvision.pr2.entity.MatchResult;
import com.chainvision.pr2.entity.ThreeWayMatch;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ThreeWayMatchResponse(
        UUID id,
        UUID invoiceId,
        UUID poId,
        UUID grnId,
        boolean qtyMatch,
        boolean priceMatch,
        MatchResult result,
        String mismatchReason,
        String aiExplanation,
        OffsetDateTime matchedAt) {

    public static ThreeWayMatchResponse from(ThreeWayMatch match) {
        return new ThreeWayMatchResponse(
                match.getId(),
                match.getInvoiceId(),
                match.getPoId(),
                match.getGrnId(),
                match.isQtyMatch(),
                match.isPriceMatch(),
                match.getResult(),
                match.getMismatchReason(),
                match.getAiExplanation(),
                match.getMatchedAt());
    }
}
