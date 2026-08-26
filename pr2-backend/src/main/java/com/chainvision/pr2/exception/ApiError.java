package com.chainvision.pr2.exception;

/** Consistent public error envelope used by every PR2 API failure response. */
public record ApiError(Error error) {

    public static ApiError of(String code, String message) {
        return new ApiError(new Error(code, message));
    }

    public record Error(String code, String message) {
    }
}
