package com.chainvision.pr2.service;

import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.entity.PurchaseOrder;
import com.chainvision.pr2.entity.PurchaseRequisition;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.repository.PurchaseOrderRepository;
import com.chainvision.pr2.repository.PurchaseRequisitionRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseRequisitionRepository requisitionRepository;
    private final SupplierScoringService supplierScoringService;

    public PurchaseOrderService(
            PurchaseOrderRepository purchaseOrderRepository,
            PurchaseRequisitionRepository requisitionRepository,
            SupplierScoringService supplierScoringService) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.requisitionRepository = requisitionRepository;
        this.supplierScoringService = supplierScoringService;
    }

    // Runs deterministic supplier selection and raises a PO from an approved-for-sourcing
    // requisition — Documentaion/00_PROJECT_CONTEXT.md Section 3 ("Sourcing & PO").
    @Transactional
    public PurchaseOrder createFromRequisition(UUID requisitionId, BigDecimal unitPrice) {
        PurchaseRequisition requisition = requisitionRepository
                .findById(requisitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase requisition not found: " + requisitionId));

        if (requisition.getStatus() != RequisitionStatus.CREATED) {
            throw new InvalidStateException(
                    "Requisition " + requisitionId + " is already " + requisition.getStatus() + "; cannot raise another PO");
        }

        SupplierScoreResult selected = supplierScoringService.selectBestSupplier(requisition.getQuantity());

        requisition.markSourced();
        PurchaseOrder po = new PurchaseOrder(requisition.getId(), selected.supplierId(), requisition.getQuantity(), unitPrice);
        purchaseOrderRepository.save(po);

        requisition.markPoRaised();
        requisitionRepository.save(requisition);

        return po;
    }

    public List<PurchaseOrder> listPurchaseOrders() {
        return purchaseOrderRepository.findAll();
    }

    public PurchaseOrder getPurchaseOrder(UUID id) {
        return purchaseOrderRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + id));
    }
}
