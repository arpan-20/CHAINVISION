package com.chainvision.pr2.requisition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.ai.GeminiClient;
import com.chainvision.pr2.ai.GeminiUnavailableException;
import com.chainvision.pr2.requisition.dto.IntentExtractionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class IntentExtractionServiceTest {

    private final GeminiClient geminiClient = Mockito.mock(GeminiClient.class);
    private final IntentExtractionService intentExtractionService =
            new IntentExtractionService(geminiClient, new ObjectMapper());

    @Test
    void extractsDemoSentenceIntoStructuredGuess() {
        when(geminiClient.generateJson(contains("We need 5,000 more units of MED-104"), anyString()))
                .thenReturn(
                        """
                        {
                          "skuGuess": "MED-104",
                          "quantity": 5000,
                          "dcGuess": null,
                          "urgency": "HIGH",
                          "confidence": 0.92,
                          "manualEntryRequired": false
                        }
                        """);

        IntentExtractionResult result =
                intentExtractionService.extract("We need 5,000 more units of MED-104 for the flu season.");

        assertThat(result.skuGuess()).isEqualTo("MED-104");
        assertThat(result.quantity()).isEqualTo(5_000);
        assertThat(result.urgency()).isEqualTo("HIGH");
        assertThat(result.confidence()).isEqualTo(0.92);
        assertThat(result.manualEntryRequired()).isFalse();
    }

    @Test
    void malformedGeminiResponseReturnsLowConfidenceFallback() {
        when(geminiClient.generateJson(contains("ambiguous"), anyString())).thenReturn("not-json");

        IntentExtractionResult result = intentExtractionService.extract("ambiguous request");

        assertThat(result.confidence()).isZero();
        assertThat(result.manualEntryRequired()).isTrue();
    }

    @Test
    void unavailableGeminiReturnsLowConfidenceFallback() {
        when(geminiClient.generateJson(contains("MED-104"), anyString()))
                .thenThrow(new GeminiUnavailableException("GEMINI_API_KEY is not configured"));

        IntentExtractionResult result = intentExtractionService.extract("Need MED-104");

        assertThat(result.confidence()).isZero();
        assertThat(result.manualEntryRequired()).isTrue();
    }

    @Test
    void missingConfidenceDefaultsToManualEntryFallback() {
        when(geminiClient.generateJson(contains("MED-104"), anyString()))
                .thenReturn(
                        """
                        {
                          "skuGuess": "MED-104",
                          "quantity": 5000,
                          "dcGuess": "DC-NORTH",
                          "urgency": "HIGH"
                        }
                        """);

        IntentExtractionResult result = intentExtractionService.extract("Need MED-104");

        assertThat(result.confidence()).isZero();
        assertThat(result.manualEntryRequired()).isTrue();
    }

}
