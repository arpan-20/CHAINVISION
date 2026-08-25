package com.chainvision.pr2.service;

import com.chainvision.pr2.ai.IntentExtractionResult;
import com.chainvision.pr2.ai.IntentExtractionService;
import com.chainvision.pr2.dto.CreateRequisitionRequest;
import com.chainvision.pr2.dto.ReplenishmentRecommendationRequest;
import com.chainvision.pr2.entity.PurchaseRequisition;
import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.repository.PurchaseRequisitionRepository;
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
    public PurchaseRequisition createFromRecommendation(ReplenishmentRecommendationRequest recommendation) {
        PurchaseRequisition requisition = new PurchaseRequisition(
                recommendation.recommendationId(),
                recommendation.skuId(),
                recommendation.dcId(),
                recommendation.recommendedQty(),
                recommendation.urgency(),
                RequisitionSource.SYSTEM,
                null);
        return requisitionRepository.save(requisition);
    }

    // NL intent extraction only (Section 9.1) — pre-fills a form, never auto-creates a
    // requisition itself. A human (or the chatbot UI) still calls createManualRequisition.
    public IntentExtractionResult parseIntent(String freeText) {
        return intentExtractionService.extract(freeText);
    }

    public List<PurchaseRequisition> listRequisitions() {
        return requisitionRepository.findAll();
    }

    public PurchaseRequisition getRequisition(UUID id) {
        return requisitionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase requisition not found: " + id));
    }
}
