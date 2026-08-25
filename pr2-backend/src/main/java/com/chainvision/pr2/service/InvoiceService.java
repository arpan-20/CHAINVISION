package com.chainvision.pr2.service;

import com.chainvision.pr2.ai.GeminiUnavailableException;
import com.chainvision.pr2.ai.InvoiceOcrService;
import com.chainvision.pr2.ai.OcrExtractionResult;
import com.chainvision.pr2.entity.Invoice;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.repository.InvoiceRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

// Invoice upload + OCR extraction — Documentaion/00_PROJECT_CONTEXT.md Section 3 ("Invoicing")
// and Section 10. OCR only ever extracts fields; it never decides whether the invoice matches
// the PO/GRN (that's ThreeWayMatchService, entirely separate deterministic code).
@Service
public class InvoiceService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceService.class);

    private final InvoiceRepository invoiceRepository;
    private final InvoiceOcrService invoiceOcrService;
    private final ObjectMapper objectMapper;
    private final Path uploadDir;

    public InvoiceService(
            InvoiceRepository invoiceRepository,
            InvoiceOcrService invoiceOcrService,
            ObjectMapper objectMapper,
            @Value("${pr2.upload-dir:./uploads}") String uploadDir) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceOcrService = invoiceOcrService;
        this.objectMapper = objectMapper;
        this.uploadDir = Path.of(uploadDir);
    }

    @Transactional
    public Invoice uploadAndExtract(
            MultipartFile file,
            UUID poId,
            String manualInvoiceNumber,
            String manualVendorName,
            Integer manualQuantity,
            BigDecimal manualUnitPrice) {
        String storedFileRef = storeFile(file);

        OcrExtractionResult ocrResult = null;
        String rawOcrJson;
        try {
            ocrResult = invoiceOcrService.extract(
                    readBytes(file), file.getContentType() != null ? file.getContentType() : "application/octet-stream");
            rawOcrJson = writeJson(ocrResult);
        } catch (GeminiUnavailableException e) {
            log.warn("OCR extraction unavailable, falling back to manual fields if provided: {}", e.getMessage());
            rawOcrJson = writeJson(Map.of("ocrAvailable", false, "reason", e.getMessage()));
        }

        String invoiceNumber = firstNonNull(manualInvoiceNumber, ocrResult != null ? ocrResult.invoiceNumber() : null);
        String vendorName = firstNonNull(manualVendorName, ocrResult != null ? ocrResult.vendorName() : null);
        Integer quantity = firstNonNull(manualQuantity, ocrResult != null ? ocrResult.quantity() : null);
        BigDecimal unitPrice = firstNonNull(manualUnitPrice, ocrResult != null ? ocrResult.unitPrice() : null);
        BigDecimal total = (ocrResult != null && ocrResult.totalAmount() != null)
                ? ocrResult.totalAmount()
                : (quantity != null && unitPrice != null ? unitPrice.multiply(BigDecimal.valueOf(quantity)) : null);

        Invoice invoice =
                new Invoice(poId, invoiceNumber, vendorName, quantity, unitPrice, total, rawOcrJson, storedFileRef);
        return invoiceRepository.save(invoice);
    }

    public List<Invoice> listInvoices() {
        return invoiceRepository.findAll();
    }

    public Invoice getInvoice(UUID id) {
        return invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
    }

    private String storeFile(MultipartFile file) {
        try {
            Files.createDirectories(uploadDir);
            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
            String storedName = UUID.randomUUID() + "-" + originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
            Path target = uploadDir.resolve(storedName);
            Files.copy(file.getInputStream(), target);
            return target.toString();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store uploaded invoice file", e);
        }
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read uploaded invoice file", e);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static <T> T firstNonNull(T a, T b) {
        return a != null ? a : b;
    }
}
