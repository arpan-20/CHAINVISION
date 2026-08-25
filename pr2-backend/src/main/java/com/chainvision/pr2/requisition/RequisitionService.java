package com.chainvision.pr2.requisition;

import com.chainvision.pr2.dto.CreateRequisitionRequest;
import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.entity.Urgency;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.requisition.dto.IntentExtractionResult;
import com.chainvision.pr2.requisition.dto.ReplenishmentRecommendationDto;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RequisitionService {

    private final PurchaseRequisitionRepository requisitionRepository;
    private final IntentExtractionService intentExtractionService;

    public RequisitionService(
            PurchaseRequisitionRepository requisitionRepository, IntentExtractionService intentExtractionService) {
        this.requisitionRepository = requisitionRepository;
        this.intentExtractionService = intentExtractionService;
    }

    @Transactional
    public PurchaseRequisition createManualRequisition(CreateRequisitionRequest request) {
        PurchaseRequisition requisition = new PurchaseRequisition(
                null,
                request.skuCode(),
                request.dcCode(),
                request.quantity(),
                request.urgency(),
                RequisitionSource.MANUAL,
                request.rawNlInput());
        return requisitionRepository.save(requisition);
    }

    // The P1 -> PR2 handoff (Documentaion/00_PROJECT_CONTEXT.md Section 4 / Section 13.2
    // POST /api/requisitions/from-recommendation).
    @Transactional
    public PurchaseRequisition createFromRecommendation(ReplenishmentRecommendationDto recommendation) {
        PurchaseRequisition requisition = new PurchaseRequisition(
                recommendation.recommendationId(),
                recommendation.skuId(),
                recommendation.dcId(),
                recommendation.recommendedQty().setScale(0, RoundingMode.CEILING).intValueExact(),
                recommendation.urgency(),
                RequisitionSource.SYSTEM,
                null);
        return requisitionRepository.save(requisition);
    }

    // Phase 12 extension hook. This is the deterministic persistence hook for a
    // human-confirmed chatbot suggestion; Gemini only pre-fills the values.
    @Transactional
    public PurchaseRequisition createFromChatbotIntent(
            String skuCode, String dcCode, Integer quantity, Urgency urgency, String rawNlInput) {
        PurchaseRequisition requisition = new PurchaseRequisition(
                null,
                skuCode,
                dcCode,
                quantity,
                urgency,
                RequisitionSource.CHATBOT,
                rawNlInput);
        return requisitionRepository.save(requisition);
    }

    // NL intent extraction only (Section 9.1) — pre-fills a form, never auto-creates a
    // requisition itself. A human (or the chatbot UI) still calls createManualRequisition.
    public IntentExtractionResult parseIntent(String freeText) {
        return intentExtractionService.extract(freeText);
    }

    public List<PurchaseRequisition> listRequisitions(RequisitionStatus status, RequisitionSource source) {
        if (status != null && source != null) {
            return requisitionRepository.findByStatusAndSource(status, source);
        }
        if (status != null) {
            return requisitionRepository.findByStatus(status);
        }
        if (source != null) {
            return requisitionRepository.findBySource(source);
        }
        return requisitionRepository.findAll();
    }

    public PurchaseRequisition getRequisition(UUID id) {
        return requisitionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase requisition not found: " + id));
    }
}
