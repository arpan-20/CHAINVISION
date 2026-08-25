package com.chainvision.pr2.purchaseorder;

import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.requisition.PurchaseRequisition;
import com.chainvision.pr2.requisition.PurchaseRequisitionRepository;
import com.chainvision.pr2.sourcing.SupplierScoringEngine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseRequisitionRepository requisitionRepository;
    private final SupplierScoringEngine supplierScoringEngine;
    private final BigDecimal baseUnitCost;

    public PurchaseOrderService(
            PurchaseOrderRepository purchaseOrderRepository,
            PurchaseRequisitionRepository requisitionRepository,
            SupplierScoringEngine supplierScoringEngine,
            @Value("${pr2.purchase-orders.base-unit-cost:100.00}") BigDecimal baseUnitCost) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.requisitionRepository = requisitionRepository;
        this.supplierScoringEngine = supplierScoringEngine;
        this.baseUnitCost = baseUnitCost;
    }

    // Runs deterministic supplier selection and raises a PO from a requisition —
    // Documentaion/00_PROJECT_CONTEXT.md Section 3 ("Sourcing & PO"). Unit price is
    // simplified for the demo as baseUnitCost * winningSupplier.priceIndex.
    @Transactional
    public PurchaseOrder generateFromRequisition(UUID requisitionId) {
        PurchaseRequisition requisition = requisitionRepository
                .findById(requisitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase requisition not found: " + requisitionId));

        if (requisition.getStatus() != RequisitionStatus.CREATED) {
            throw new InvalidStateException(
                    "Requisition " + requisitionId + " is already " + requisition.getStatus() + "; cannot raise another PO");
        }

        SupplierScoreResult selected = supplierScoringEngine.selectBestSupplier(requisition.getQuantity());
        BigDecimal unitPrice = baseUnitCost
                .multiply(selected.supplier().getPriceIndex())
                .setScale(2, RoundingMode.HALF_UP);

        PurchaseOrder po = new PurchaseOrder(requisition.getId(), selected.supplierId(), requisition.getQuantity(), unitPrice);
        PurchaseOrder saved = purchaseOrderRepository.save(po);

        requisition.markPoRaised();
        requisitionRepository.save(requisition);

        return saved;
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
