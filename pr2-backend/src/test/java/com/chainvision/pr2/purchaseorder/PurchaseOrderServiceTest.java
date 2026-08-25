package com.chainvision.pr2.purchaseorder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.dto.SupplierScoreResult;
import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.entity.Urgency;
import com.chainvision.pr2.requisition.PurchaseRequisition;
import com.chainvision.pr2.requisition.PurchaseRequisitionRepository;
import com.chainvision.pr2.sourcing.Supplier;
import com.chainvision.pr2.sourcing.SupplierScoringEngine;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class PurchaseOrderServiceTest {

    private final PurchaseOrderRepository purchaseOrderRepository = Mockito.mock(PurchaseOrderRepository.class);
    private final PurchaseRequisitionRepository requisitionRepository =
            Mockito.mock(PurchaseRequisitionRepository.class);
    private final SupplierScoringEngine supplierScoringEngine = Mockito.mock(SupplierScoringEngine.class);

    private final PurchaseOrderService purchaseOrderService = new PurchaseOrderService(
            purchaseOrderRepository, requisitionRepository, supplierScoringEngine, new BigDecimal("100.00"));

    @Test
    void generatesPurchaseOrderFromRequisitionUsingSupplierScoringEngine() {
        UUID requisitionId = UUID.randomUUID();
        UUID supplierId = UUID.randomUUID();
        PurchaseRequisition requisition = requisition("MED-104", "DC-NORTH", 5_000);
        ReflectionTestUtils.setField(requisition, "id", requisitionId);
        Supplier supplier = supplier(supplierId, "Reliable supplier", "1.18");

        when(requisitionRepository.findById(requisitionId)).thenReturn(Optional.of(requisition));
        when(supplierScoringEngine.selectBestSupplier(5_000))
                .thenReturn(new SupplierScoreResult(supplierId, "Reliable supplier", new BigDecimal("1.0000"), supplier));
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PurchaseOrder po = purchaseOrderService.generateFromRequisition(requisitionId);

        assertThat(po.getRequisitionId()).isEqualTo(requisitionId);
        assertThat(po.getSupplierId()).isEqualTo(supplierId);
        assertThat(po.getQuantity()).isEqualTo(5_000);
        assertThat(po.getUnitPrice()).isEqualByComparingTo("118.00");
        assertThat(po.getTotalAmount()).isEqualByComparingTo("590000.00");
        assertThat(requisition.getStatus()).isEqualTo(RequisitionStatus.PO_RAISED);

        verify(supplierScoringEngine).selectBestSupplier(5_000);
        verify(purchaseOrderRepository).save(any(PurchaseOrder.class));
        verify(requisitionRepository).save(requisition);
    }

    private static PurchaseRequisition requisition(String skuCode, String dcCode, int quantity) {
        return new PurchaseRequisition(null, skuCode, dcCode, quantity, Urgency.HIGH, RequisitionSource.MANUAL, null);
    }

    private static Supplier supplier(UUID id, String name, String priceIndex) {
        Supplier supplier = newSupplier();
        ReflectionTestUtils.setField(supplier, "id", id);
        ReflectionTestUtils.setField(supplier, "name", name);
        ReflectionTestUtils.setField(supplier, "priceIndex", new BigDecimal(priceIndex));
        ReflectionTestUtils.setField(supplier, "avgLeadTimeDays", 4);
        ReflectionTestUtils.setField(supplier, "otdScore", new BigDecimal("0.98"));
        ReflectionTestUtils.setField(supplier, "qualityScore", new BigDecimal("0.99"));
        ReflectionTestUtils.setField(supplier, "capacityUnits", 12_000);
        return supplier;
    }

    private static Supplier newSupplier() {
        try {
            var constructor = Supplier.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Unable to instantiate Supplier for PO generation test", ex);
        }
    }
}
