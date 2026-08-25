package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.PurchaseRequisition;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseRequisitionRepository extends JpaRepository<PurchaseRequisition, UUID> {
}
