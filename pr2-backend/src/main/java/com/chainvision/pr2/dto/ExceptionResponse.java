package com.chainvision.pr2.dto;

import java.util.UUID;

public record ExceptionResponse(
        InvoiceResponse invoice,
        PaymentApprovalResponse paymentApproval,
        ThreeWayMatchResponse latestMatch,
        String aiExplanation) {

    public static ExceptionResponse of(
            InvoiceResponse invoice, PaymentApprovalResponse paymentApproval, ThreeWayMatchResponse latestMatch) {
        return new ExceptionResponse(
                invoice,
                paymentApproval,
                latestMatch,
                latestMatch != null ? latestMatch.aiExplanation() : null);
    }

    public UUID invoiceId() {
        return invoice.id();
    }
}
