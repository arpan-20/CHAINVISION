package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.PurchaseOrder;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {
}
