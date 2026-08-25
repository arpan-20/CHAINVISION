package com.chainvision.pr2.exception;

// Thrown when a deterministic business rule can't be satisfied (e.g. no
// supplier has enough capacity, or an invoice is missing fields required to run the 3-way match).
public class BusinessRuleViolationException extends RuntimeException {

    public BusinessRuleViolationException(String message) {
        super(message);
    }
}
