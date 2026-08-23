package com.chainvision.pr2;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// CHAINVISION — PR2 backend (Procure-to-Pay)
// Bootstrap only. Business controllers/services (requisition, sourcing,
// purchaseorder, goodsreceipt, invoice, payment) land in later phases —
// see Section 13.2 of 00_PROJECT_CONTEXT.md. DB access via Spring Data
// JPA against the Supabase-hosted Postgres `pr2` schema (Section 5.4/14).
@SpringBootApplication
public class Pr2Application {

    public static void main(String[] args) {
        SpringApplication.run(Pr2Application.class, args);
    }

    @RestController
    static class HealthController {

        @GetMapping("/health")
        public Map<String, String> health() {
            return Map.of("status", "ok");
        }
    }
}
