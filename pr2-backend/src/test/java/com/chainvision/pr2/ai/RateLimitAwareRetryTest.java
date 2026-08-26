package com.chainvision.pr2.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

class RateLimitAwareRetryTest {

    @Test
    void retriesTransientFailuresAtMostTwiceThenSucceeds() throws Exception {
        AtomicInteger attempts = new AtomicInteger();

        String result = RateLimitAwareRetry.execute(() -> {
            if (attempts.incrementAndGet() < 3) {
                throw new ResourceAccessException("Gemini unavailable");
            }
            return "ok";
        }, "test Gemini", 2, Duration.ZERO);

        assertThat(result).isEqualTo("ok");
        assertThat(attempts).hasValue(3);
    }

    @Test
    void doesNotRetryNonTransientFailures() {
        AtomicInteger attempts = new AtomicInteger();

        assertThatThrownBy(() -> RateLimitAwareRetry.execute(() -> {
            attempts.incrementAndGet();
            throw new IllegalArgumentException("bad Gemini key");
        }, "test Gemini", 2, Duration.ZERO)).isInstanceOf(IllegalArgumentException.class);

        assertThat(attempts).hasValue(1);
    }
}
