package com.chainvision.pr2.invoice;

import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class OcrClient {

    private final RestClient restClient;
    private final String ocrEndpointUrl;
    private final String internalApiKey;

    public OcrClient(
            @Value("${p1.ocr-endpoint-url}") String ocrEndpointUrl,
            @Value("${internal.api-key}") String internalApiKey) {
        this.restClient = RestClient.create();
        this.ocrEndpointUrl = ocrEndpointUrl;
        this.internalApiKey = internalApiKey;
    }

    public String extractRawText(byte[] fileBytes, String filename, String contentType) {
        if (internalApiKey == null || internalApiKey.isBlank()) {
            throw new OcrClientException("internal.api-key is not configured");
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.parseMediaType(safeContentType(contentType)));
        body.add("file", new HttpEntity<>(new NamedByteArrayResource(fileBytes, safeFilename(filename)), fileHeaders));

        try {
            OcrResponse response = restClient.post()
                    .uri(ocrEndpointUrl)
                    .header("x-internal-key", internalApiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(OcrResponse.class);

            if (response == null || response.rawText() == null || response.rawText().isBlank()) {
                throw new OcrClientException("P1 OCR endpoint returned no rawText");
            }
            return response.rawText();
        } catch (OcrClientException e) {
            throw e;
        } catch (Exception e) {
            throw new OcrClientException(
                    "P1 OCR service is unavailable; the invoice requires manual review", e);
        }
    }

    private static String safeFilename(String filename) {
        return filename == null || filename.isBlank() ? "invoice-upload" : filename;
    }

    private static String safeContentType(String contentType) {
        return contentType == null || contentType.isBlank() ? MediaType.APPLICATION_OCTET_STREAM_VALUE : contentType;
    }

    private record OcrResponse(String rawText) {
    }

    public static class OcrClientException extends RuntimeException {
        public OcrClientException(String message) {
            super(message);
        }

        public OcrClientException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static class NamedByteArrayResource extends ByteArrayResource {

        private final String filename;

        NamedByteArrayResource(byte[] byteArray, String filename) {
            super(Objects.requireNonNull(byteArray, "byteArray"));
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
