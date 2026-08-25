package com.chainvision.pr2.exception;

// Thrown when an operation is attempted against an entity that isn't in a
// valid state for it (e.g. raising a PO from a requisition that already has one).
public class InvalidStateException extends RuntimeException {

    public InvalidStateException(String message) {
        super(message);
    }
}
