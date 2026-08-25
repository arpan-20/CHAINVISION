package com.chainvision.pr2.invoice;

import com.chainvision.pr2.dto.InvoiceResponse;
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

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

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
}
