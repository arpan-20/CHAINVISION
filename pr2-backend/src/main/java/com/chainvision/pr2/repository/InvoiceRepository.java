package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.Invoice;
import com.chainvision.pr2.entity.InvoiceStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    List<Invoice> findByStatus(InvoiceStatus status);
}
