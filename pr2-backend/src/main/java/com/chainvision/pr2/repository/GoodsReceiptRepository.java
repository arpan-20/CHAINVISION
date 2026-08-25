package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.GoodsReceipt;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoodsReceiptRepository extends JpaRepository<GoodsReceipt, UUID> {

    List<GoodsReceipt> findByPoId(UUID poId);
}
