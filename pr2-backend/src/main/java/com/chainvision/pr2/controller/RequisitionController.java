package com.chainvision.pr2.controller;

import com.chainvision.pr2.ai.IntentExtractionResult;
import com.chainvision.pr2.dto.CreateRequisitionRequest;
import com.chainvision.pr2.dto.ParseIntentRequest;
import com.chainvision.pr2.dto.ReplenishmentRecommendationRequest;
import com.chainvision.pr2.dto.RequisitionResponse;
import com.chainvision.pr2.entity.PurchaseRequisition;
import com.chainvision.pr2.service.RequisitionService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
@RestController
@RequestMapping("/api/requisitions")
public class RequisitionController {

    private final RequisitionService requisitionService;

    public RequisitionController(RequisitionService requisitionService) {
        this.requisitionService = requisitionService;
    }

    @PostMapping
    public ResponseEntity<RequisitionResponse> create(@Valid @RequestBody CreateRequisitionRequest request) {
        PurchaseRequisition created = requisitionService.createManualRequisition(request);
        return created(created);
    }

    // Called by P1 when its deterministic engine emits a new ReplenishmentRecommendation
    // (Documentaion/00_PROJECT_CONTEXT.md Section 4).
    @PostMapping("/from-recommendation")
    public ResponseEntity<RequisitionResponse> createFromRecommendation(
            @Valid @RequestBody ReplenishmentRecommendationRequest recommendation) {
        PurchaseRequisition created = requisitionService.createFromRecommendation(recommendation);
        return created(created);
    }

    // Proxies to Gemini for NL intent extraction only (Section 9.1) — returns a pre-filled
    // suggestion, does not itself create a requisition.
    @PostMapping("/parse-intent")
    public IntentExtractionResult parseIntent(@Valid @RequestBody ParseIntentRequest request) {
        return requisitionService.parseIntent(request.text());
    }

    @GetMapping
    public List<RequisitionResponse> list() {
        return requisitionService.listRequisitions().stream().map(RequisitionResponse::from).toList();
    }

    @GetMapping("/{id}")
    public RequisitionResponse getById(@PathVariable UUID id) {
        return RequisitionResponse.from(requisitionService.getRequisition(id));
    }

    private ResponseEntity<RequisitionResponse> created(PurchaseRequisition requisition) {
        RequisitionResponse body = RequisitionResponse.from(requisition);
        return ResponseEntity.created(URI.create("/api/requisitions/" + body.id())).body(body);
    }
}
