package com.chainvision.pr2.requisition;

import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseRequisitionRepository extends JpaRepository<PurchaseRequisition, UUID> {
    List<PurchaseRequisition> findByStatus(RequisitionStatus status);

    List<PurchaseRequisition> findBySource(RequisitionSource source);

    List<PurchaseRequisition> findByStatusAndSource(RequisitionStatus status, RequisitionSource source);
}
