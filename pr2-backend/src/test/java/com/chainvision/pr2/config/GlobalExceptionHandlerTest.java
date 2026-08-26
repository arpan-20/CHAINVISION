package com.chainvision.pr2.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.chainvision.pr2.exception.ApiError;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.invoice.OcrClient.OcrClientException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsMalformedRequestsToNestedValidationError() {
        var response = handler.handleMalformedRequest(new HttpMessageNotReadableException("bad JSON"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isEqualTo(ApiError.of("VALIDATION_ERROR", "Request is malformed or invalid"));
    }

    @Test
    void mapsNotFoundAndUpstreamFailuresToConsistentEnvelope() {
        var notFound = handler.handleNotFound(new ResourceNotFoundException("Invoice not found"));
        var upstream = handler.handleOcrUnavailable(new OcrClientException("P1 stopped"));

        assertThat(notFound.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(notFound.getBody()).isEqualTo(ApiError.of("NOT_FOUND", "Invoice not found"));
        assertThat(upstream.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(upstream.getBody().error().code()).isEqualTo("UPSTREAM_SERVICE_ERROR");
    }

    @Test
    void doesNotLeakUnexpectedExceptionDetails() {
        var response = handler.handleUnexpected(new IllegalStateException("secret database credentials"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isEqualTo(ApiError.of("INTERNAL_ERROR", "Unexpected error occurred"));
    }
}
