package com.chainvision.pr2.invoice;

import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.invoice.InvoiceStructuringService.StructuredInvoice;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import com.chainvision.pr2.payment.PaymentApprovalRepository;

// Invoice upload pipeline, Documentaion/00_PROJECT_CONTEXT.md Section 3 and Section 10:
// P1/Tesseract extracts raw OCR text first; Gemini only structures that raw text into JSON.
// Matching decisions stay out of this service and belong to the deterministic Phase 17 flow.
@Service
public class InvoiceService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceService.class);
    private static final BigDecimal ZERO_MONEY = BigDecimal.ZERO.setScale(2);

    private final InvoiceRepository invoiceRepository;
    private final OcrClient ocrClient;
    private final InvoiceStructuringService invoiceStructuringService;
    private final ObjectMapper objectMapper;
    private final Path uploadDir;
    private final ThreeWayMatchRepository threeWayMatchRepository;
    private final PaymentApprovalRepository paymentApprovalRepository;

    public InvoiceService(
            InvoiceRepository invoiceRepository,
            OcrClient ocrClient,
            InvoiceStructuringService invoiceStructuringService,
            ObjectMapper objectMapper,
            String uploadDir) {
        this(invoiceRepository, ocrClient, invoiceStructuringService, objectMapper, null, null, uploadDir);
    }

    @Autowired
    public InvoiceService(
            InvoiceRepository invoiceRepository,
            OcrClient ocrClient,
            InvoiceStructuringService invoiceStructuringService,
            ObjectMapper objectMapper,
            ThreeWayMatchRepository threeWayMatchRepository,
            PaymentApprovalRepository paymentApprovalRepository,
            @Value("${pr2.upload-dir:./uploads}") String uploadDir) {
        this.invoiceRepository = invoiceRepository;
        this.ocrClient = ocrClient;
        this.invoiceStructuringService = invoiceStructuringService;
        this.objectMapper = objectMapper;
        this.threeWayMatchRepository = threeWayMatchRepository;
        this.paymentApprovalRepository = paymentApprovalRepository;
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
        UUID uploadId = UUID.randomUUID();
        String storedFileRef = storeFile(file);
        StructuredInvoice structuredInvoice = extractAndStructure(file);

        String invoiceNumber = firstNonBlank(
                manualInvoiceNumber, structuredInvoice.invoiceNumber(), "UNREAD-" + uploadId);
        String vendorName = firstNonBlank(manualVendorName, structuredInvoice.vendorName(), "UNKNOWN_VENDOR");
        Integer quantity = firstNonNull(manualQuantity, structuredInvoice.quantity(), 0);
        BigDecimal unitPrice = firstNonNull(manualUnitPrice, structuredInvoice.unitPrice(), ZERO_MONEY);
        BigDecimal total = firstNonNull(
                structuredInvoice.totalAmount(),
                quantity != null && unitPrice != null ? unitPrice.multiply(BigDecimal.valueOf(quantity)) : null,
                ZERO_MONEY);

        Invoice invoice = new Invoice(
                poId,
                invoiceNumber,
                vendorName,
                quantity,
                unitPrice,
                total,
                structuredInvoice.rawJson(),
                storedFileRef);
        return invoiceRepository.save(invoice);
    }

    public List<Invoice> listInvoices() {
        return invoiceRepository.findAll();
    }

    public Invoice getInvoice(UUID id) {
        return invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
    }

    @Transactional
    public void delete(UUID id) {
        if (!invoiceRepository.existsById(id)) {
            throw new ResourceNotFoundException("Invoice not found: " + id);
        }
        if (paymentApprovalRepository == null || threeWayMatchRepository == null) {
            invoiceRepository.deleteById(id);
            return;
        }
        paymentApprovalRepository.deleteAll(paymentApprovalRepository.findByInvoiceId(id));
        threeWayMatchRepository.deleteAll(threeWayMatchRepository.findByInvoiceIdOrderByMatchedAtDesc(id));
        invoiceRepository.deleteById(id);
    }

    private StructuredInvoice extractAndStructure(MultipartFile file) {
        try {
            String rawText = ocrClient.extractRawText(
                    readBytes(file),
                    file.getOriginalFilename(),
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream");
            return invoiceStructuringService.structure(rawText);
        } catch (Exception e) {
            log.warn("Invoice OCR/structuring failed; persisting manual-review invoice shell: {}", e.getMessage());
            return StructuredInvoice.manualReview(writeJson(Map.of(
                    "manualReviewRequired", true,
                    "stage", "OCR",
                    "reason", safeMessage(e),
                    "rawOcrText", "")));
        }
    }

    private static String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
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
            return "{\"manualReviewRequired\":true}";
        }
    }

    private static String firstNonBlank(String first, String second, String fallback) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return fallback;
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
