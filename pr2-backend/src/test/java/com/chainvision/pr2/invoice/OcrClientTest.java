package com.chainvision.pr2.invoice;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class OcrClientTest {

    @Test
    void wrapsAnUnreachableP1OcrEndpointInAClearUpstreamException() {
        OcrClient client = new OcrClient("http://127.0.0.1:1/internal/ocr", "test-key");

        assertThatThrownBy(() -> client.extractRawText(new byte[] {1}, "invoice.pdf", "application/pdf"))
                .isInstanceOf(OcrClient.OcrClientException.class)
                .hasMessageContaining("P1 OCR service is unavailable");
    }
}
