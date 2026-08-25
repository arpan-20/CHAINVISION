package com.chainvision.pr2.exception;

import java.time.OffsetDateTime;
import java.util.Map;

public record ApiError(
        OffsetDateTime timestamp,
        int status,
        String error,
        String message,
        Map<String, String> fieldErrors) {

    public static ApiError of(int status, String error, String message) {
        return new ApiError(OffsetDateTime.now(), status, error, message, null);
    }

    public static ApiError validation(int status, String error, Map<String, String> fieldErrors) {
        return new ApiError(OffsetDateTime.now(), status, error, "Validation failed", fieldErrors);
    }
}
