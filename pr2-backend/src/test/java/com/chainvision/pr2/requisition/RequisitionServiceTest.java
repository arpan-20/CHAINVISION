package com.chainvision.pr2.requisition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.dto.CreateRequisitionRequest;
import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.entity.Urgency;
import com.chainvision.pr2.requisition.dto.ReplenishmentRecommendationDto;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class RequisitionServiceTest {

    private final PurchaseRequisitionRepository requisitionRepository =
            Mockito.mock(PurchaseRequisitionRepository.class);
    private final IntentExtractionService intentExtractionService = Mockito.mock(IntentExtractionService.class);

    private final RequisitionService requisitionService =
            new RequisitionService(requisitionRepository, intentExtractionService);

    @Test
    void createsManualRequisitionWithCreatedStatus() {
        when(requisitionRepository.save(any(PurchaseRequisition.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PurchaseRequisition requisition = requisitionService.createManualRequisition(
                new CreateRequisitionRequest("MED-104", "DC-NORTH", 5_000, Urgency.HIGH, null));

        assertThat(requisition.getSource()).isEqualTo(RequisitionSource.MANUAL);
        assertThat(requisition.getStatus()).isEqualTo(RequisitionStatus.CREATED);
        assertThat(requisition.getRecommendationId()).isNull();
        assertThat(requisition.getSkuCode()).isEqualTo("MED-104");
        assertThat(requisition.getDcCode()).isEqualTo("DC-NORTH");
        assertThat(requisition.getQuantity()).isEqualTo(5_000);
    }

    @Test
    void createsSystemRequisitionFromRecommendationPayload() {
        when(requisitionRepository.save(any(PurchaseRequisition.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PurchaseRequisition requisition = requisitionService.createFromRecommendation(
                new ReplenishmentRecommendationDto(
                        "rec-123",
                        "MED-104",
                        "Oseltamivir 75mg",
                        "DC-NORTH",
                        new BigDecimal("5000"),
                        Urgency.CRITICAL,
                        "Demand spike",
                        "AI rationale is accepted but not persisted",
                        "Near-expiry context",
                        "2026-08-25T10:00:00Z"));

        assertThat(requisition.getSource()).isEqualTo(RequisitionSource.SYSTEM);
        assertThat(requisition.getStatus()).isEqualTo(RequisitionStatus.CREATED);
        assertThat(requisition.getRecommendationId()).isEqualTo("rec-123");
        assertThat(requisition.getSkuCode()).isEqualTo("MED-104");
        assertThat(requisition.getDcCode()).isEqualTo("DC-NORTH");
        assertThat(requisition.getQuantity()).isEqualTo(5_000);
    }

    @Test
    void createsChatbotRequisitionOnlyAfterConfirmedIntentValues() {
        when(requisitionRepository.save(any(PurchaseRequisition.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PurchaseRequisition requisition = requisitionService.createFromChatbotIntent(
                "MED-104",
                "DC-NORTH",
                5_000,
                Urgency.HIGH,
                "We need 5,000 more units of MED-104 for the flu season.");

        assertThat(requisition.getSource()).isEqualTo(RequisitionSource.CHATBOT);
        assertThat(requisition.getStatus()).isEqualTo(RequisitionStatus.CREATED);
        assertThat(requisition.getRawNlInput())
                .isEqualTo("We need 5,000 more units of MED-104 for the flu season.");
    }

    @Test
    void listsRequisitionsByStatusAndSourceWhenBothFiltersProvided() {
        requisitionService.listRequisitions(RequisitionStatus.CREATED, RequisitionSource.SYSTEM);

        verify(requisitionRepository).findByStatusAndSource(RequisitionStatus.CREATED, RequisitionSource.SYSTEM);
    }

    @Test
    void listsRequisitionsBySingleFilterOrAll() {
        when(requisitionRepository.findByStatus(RequisitionStatus.CREATED)).thenReturn(List.of());
        when(requisitionRepository.findBySource(RequisitionSource.MANUAL)).thenReturn(List.of());
        when(requisitionRepository.findAll()).thenReturn(List.of());

        requisitionService.listRequisitions(RequisitionStatus.CREATED, null);
        requisitionService.listRequisitions(null, RequisitionSource.MANUAL);
        requisitionService.listRequisitions(null, null);

        verify(requisitionRepository).findByStatus(RequisitionStatus.CREATED);
        verify(requisitionRepository).findBySource(RequisitionSource.MANUAL);
        verify(requisitionRepository).findAll();
    }
}
