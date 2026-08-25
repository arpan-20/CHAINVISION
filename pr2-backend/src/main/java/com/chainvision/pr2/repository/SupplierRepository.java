package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.Supplier;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {
}
