package com.chainvision.pr2.controller;

import com.chainvision.pr2.dto.CreatePurchaseOrderRequest;
import com.chainvision.pr2.dto.PurchaseOrderResponse;
import com.chainvision.pr2.entity.PurchaseOrder;
import com.chainvision.pr2.service.PurchaseOrderService;
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
@RequestMapping("/api/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    public PurchaseOrderController(PurchaseOrderService purchaseOrderService) {
        this.purchaseOrderService = purchaseOrderService;
    }

    @PostMapping("/{requisitionId}")
    public ResponseEntity<PurchaseOrderResponse> create(
            @PathVariable UUID requisitionId, @Valid @RequestBody CreatePurchaseOrderRequest request) {
        PurchaseOrder po = purchaseOrderService.createFromRequisition(requisitionId, request.unitPrice());
        PurchaseOrderResponse body = PurchaseOrderResponse.from(po);
        return ResponseEntity.created(URI.create("/api/purchase-orders/" + body.id())).body(body);
    }

    @GetMapping
    public List<PurchaseOrderResponse> list() {
        return purchaseOrderService.listPurchaseOrders().stream().map(PurchaseOrderResponse::from).toList();
    }

    @GetMapping("/{id}")
    public PurchaseOrderResponse getById(@PathVariable UUID id) {
        return PurchaseOrderResponse.from(purchaseOrderService.getPurchaseOrder(id));
    }
}
