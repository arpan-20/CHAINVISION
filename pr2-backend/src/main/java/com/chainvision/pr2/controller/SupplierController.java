package com.chainvision.pr2.controller;

import com.chainvision.pr2.dto.SupplierResponse;
import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.dto.SupplierSelectionResponse;
import com.chainvision.pr2.service.SupplierService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    public List<SupplierResponse> list() {
        return supplierService.listSuppliers().stream().map(SupplierResponse::from).toList();
    }

    // Read-only preview of the deterministic scoring/ranking for a requisition. Does not create
    // a PO or mutate state — POST /api/purchase-orders/{requisitionId} runs the authoritative
    // selection when actually raising the PO.
    @PostMapping("/select/{requisitionId}")
    public SupplierSelectionResponse select(@PathVariable UUID requisitionId) {
        List<SupplierScoreResult> ranking = supplierService.previewSelection(requisitionId);
        List<SupplierSelectionResponse.ScoredSupplier> scored = ranking.stream()
                .map(r -> new SupplierSelectionResponse.ScoredSupplier(SupplierResponse.from(r.supplier()), r.score()))
                .toList();
        SupplierScoreResult best = ranking.get(0);
        return new SupplierSelectionResponse(SupplierResponse.from(best.supplier()), best.score(), scored);
    }
}
