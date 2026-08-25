package com.chainvision.pr2.repository;

import com.chainvision.pr2.entity.ThreeWayMatch;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThreeWayMatchRepository extends JpaRepository<ThreeWayMatch, UUID> {

    List<ThreeWayMatch> findByInvoiceIdOrderByMatchedAtDesc(UUID invoiceId);

    default Optional<ThreeWayMatch> findLatestByInvoiceId(UUID invoiceId) {
        return findByInvoiceIdOrderByMatchedAtDesc(invoiceId).stream().findFirst();
    }
}
