package com.chainvision.pr2.controller;

import com.chainvision.pr2.dto.InvoiceResponse;
import com.chainvision.pr2.dto.ThreeWayMatchResponse;
import com.chainvision.pr2.entity.Invoice;
import com.chainvision.pr2.service.InvoiceService;
import com.chainvision.pr2.service.MatchingService;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final MatchingService matchingService;

    public InvoiceController(InvoiceService invoiceService, MatchingService matchingService) {
        this.invoiceService = invoiceService;
        this.matchingService = matchingService;
    }

    // Multipart upload; triggers Gemini OCR extraction (Section 10) when GEMINI_API_KEY is
    // configured. The manual* params are optional overrides/fallbacks — see InvoiceService and
    // SETUP.md for why they exist (keeps this endpoint fully testable without a live API key).
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<InvoiceResponse> upload(
            @RequestParam MultipartFile file,
            @RequestParam(required = false) UUID poId,
            @RequestParam(required = false) String manualInvoiceNumber,
            @RequestParam(required = false) String manualVendorName,
            @RequestParam(required = false) Integer manualQuantity,
            @RequestParam(required = false) BigDecimal manualUnitPrice) {
        Invoice invoice = invoiceService.uploadAndExtract(
                file, poId, manualInvoiceNumber, manualVendorName, manualQuantity, manualUnitPrice);
        InvoiceResponse body = InvoiceResponse.from(invoice);
        return ResponseEntity.created(URI.create("/api/invoices/" + body.id())).body(body);
    }

    @GetMapping
    public List<InvoiceResponse> list() {
        return invoiceService.listInvoices().stream().map(InvoiceResponse::from).toList();
    }

    @GetMapping("/{id}")
    public InvoiceResponse getById(@PathVariable UUID id) {
        return InvoiceResponse.from(invoiceService.getInvoice(id));
    }

    // Runs the deterministic 3-way match (PO vs GRN vs invoice) — Section 3 ("Invoicing").
    @PostMapping("/{id}/match")
    public ThreeWayMatchResponse match(@PathVariable UUID id) {
        return ThreeWayMatchResponse.from(matchingService.runMatch(id));
    }
}
