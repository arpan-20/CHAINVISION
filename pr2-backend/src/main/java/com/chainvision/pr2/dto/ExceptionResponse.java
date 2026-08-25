package com.chainvision.pr2.dto;

import java.util.UUID;

public record ExceptionResponse(InvoiceResponse invoice, ThreeWayMatchResponse latestMatch) {

    public static ExceptionResponse of(InvoiceResponse invoice, ThreeWayMatchResponse latestMatch) {
        return new ExceptionResponse(invoice, latestMatch);
    }

    public UUID invoiceId() {
        return invoice.id();
    }
}
