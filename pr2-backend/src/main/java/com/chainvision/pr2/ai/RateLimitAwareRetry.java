package com.chainvision.pr2.ai;

import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

/**
 * Small, dependency-free retry wrapper for transient upstream calls. A call is attempted once
 * plus at most two retries; 4xx responses other than 429 fail immediately.
 */
public final class RateLimitAwareRetry {

    public static final int MAX_RETRIES = 2;
    private static final Logger log = LoggerFactory.getLogger(RateLimitAwareRetry.class);
    private static final Duration DEFAULT_BASE_DELAY = Duration.ofMillis(500);

    private RateLimitAwareRetry() {
    }

    @FunctionalInterface
    public interface RetryableOperation<T> {
        T execute() throws Exception;
    }

    public static <T> T execute(RetryableOperation<T> operation, String label) throws Exception {
        return execute(operation, label, MAX_RETRIES, DEFAULT_BASE_DELAY);
    }

    // The overload makes the utility fast and deterministic to exercise in unit tests.
    static <T> T execute(RetryableOperation<T> operation, String label, int maxRetries, Duration baseDelay)
            throws Exception {
        int retries = Math.min(Math.max(maxRetries, 0), MAX_RETRIES);
        for (int attempt = 0; ; attempt++) {
            try {
                return operation.execute();
            } catch (Exception exception) {
                if (attempt >= retries || !isRetryable(exception)) {
                    throw exception;
                }

                Duration delay = backoffWithJitter(attempt + 1, baseDelay);
                log.warn("{} failed; retry {}/{} in {} ms: {}", label, attempt + 1, retries,
                        delay.toMillis(), exception.getMessage());
                try {
                    Thread.sleep(delay.toMillis());
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw exception;
                }
            }
        }
    }

    static boolean isRetryable(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof ResourceAccessException) {
                return true;
            }
            if (current instanceof RestClientResponseException responseException) {
                int status = responseException.getStatusCode().value();
                return status == 429 || status >= 500;
            }
            current = current.getCause();
        }
        return false;
    }

    private static Duration backoffWithJitter(int retryNumber, Duration baseDelay) {
        long baseMillis = Math.max(baseDelay.toMillis(), 0);
        long exponentialDelay = baseMillis * (1L << (retryNumber - 1));
        long jitter = baseMillis == 0 ? 0 : ThreadLocalRandom.current().nextLong(baseMillis + 1);
        return Duration.ofMillis(exponentialDelay + jitter);
    }
}
