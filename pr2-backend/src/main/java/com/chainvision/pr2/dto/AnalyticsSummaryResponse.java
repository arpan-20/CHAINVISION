package com.chainvision.pr2.dto;

public record AnalyticsSummaryResponse(
        long totalRequisitions,
        long totalPurchaseOrders,
        long totalInvoices,
        long prsInFlight,
        long posInFlight,
        long invoicesInFlight,
        long autoApprovedPayments,
        long totalPayments,
        long mismatchedThreeWayMatches,
        long totalThreeWayMatches,
        double touchlessRatePct,
        double exceptionRatePct,
        Double avgCycleTimeHours) {
}
