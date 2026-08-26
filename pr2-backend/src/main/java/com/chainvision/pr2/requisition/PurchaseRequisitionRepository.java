package com.chainvision.pr2.requisition;

import com.chainvision.pr2.entity.RequisitionSource;
import com.chainvision.pr2.entity.RequisitionStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseRequisitionRepository extends JpaRepository<PurchaseRequisition, UUID> {
    @Query(value = "select * from pr2.purchase_requisitions where status::text = :status", nativeQuery = true)
    List<PurchaseRequisition> findByStatusName(@Param("status") String status);

    default List<PurchaseRequisition> findByStatus(RequisitionStatus status) {
        return findByStatusName(status.name());
    }

    @Query(value = "select * from pr2.purchase_requisitions where source::text = :source", nativeQuery = true)
    List<PurchaseRequisition> findBySourceName(@Param("source") String source);

    default List<PurchaseRequisition> findBySource(RequisitionSource source) {
        return findBySourceName(source.name());
    }

    @Query(value = "select * from pr2.purchase_requisitions where status::text = :status and source::text = :source", nativeQuery = true)
    List<PurchaseRequisition> findByStatusAndSourceName(
            @Param("status") String status, @Param("source") String source);

    default List<PurchaseRequisition> findByStatusAndSource(
            RequisitionStatus status, RequisitionSource source) {
        return findByStatusAndSourceName(status.name(), source.name());
    }
}
