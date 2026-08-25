package com.chainvision.pr2.service;

import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.entity.PurchaseRequisition;
import com.chainvision.pr2.entity.Supplier;
import com.chainvision.pr2.repository.SupplierRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final SupplierScoringService supplierScoringService;
    private final RequisitionService requisitionService;

    public SupplierService(
            SupplierRepository supplierRepository,
            SupplierScoringService supplierScoringService,
            RequisitionService requisitionService) {
        this.supplierRepository = supplierRepository;
        this.supplierScoringService = supplierScoringService;
        this.requisitionService = requisitionService;
    }

    public List<Supplier> listSuppliers() {
        return supplierRepository.findAll();
    }

    // Read-only preview: scores suppliers for a requisition without mutating any state.
    // The actual, authoritative selection happens inside PurchaseOrderService when the PO is
    // raised (Documentaion/00_PROJECT_CONTEXT.md Section 3, "Sourcing & PO").
    public List<SupplierScoreResult> previewSelection(UUID requisitionId) {
        PurchaseRequisition requisition = requisitionService.getRequisition(requisitionId);
        return supplierScoringService.rankEligibleSuppliers(requisition.getQuantity());
    }
}
