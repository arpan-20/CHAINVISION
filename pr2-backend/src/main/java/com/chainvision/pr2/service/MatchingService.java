package com.chainvision.pr2.service;

import com.chainvision.pr2.exception.BusinessRuleViolationException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.goodsreceipt.GoodsReceipt;
import com.chainvision.pr2.goodsreceipt.GoodsReceiptRepository;
import com.chainvision.pr2.invoice.Invoice;
import com.chainvision.pr2.invoice.InvoiceRepository;
import com.chainvision.pr2.invoice.MatchResult;
import com.chainvision.pr2.invoice.MismatchExplanationService;
import com.chainvision.pr2.invoice.ThreeWayMatch;
import com.chainvision.pr2.invoice.ThreeWayMatchEngine;
import com.chainvision.pr2.invoice.ThreeWayMatchRepository;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import com.chainvision.pr2.purchaseorder.PurchaseOrderRepository;
import com.chainvision.pr2.requisition.PurchaseRequisition;
import com.chainvision.pr2.requisition.PurchaseRequisitionRepository;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The deterministic 3-way match — Documentaion/00_PROJECT_CONTEXT.md Section 3 ("Invoicing") and
// Section 5.1's hard rule: this is plain arithmetic against configurable tolerances, never an LLM
// decision. On MISMATCHED, Gemini is asked only to *phrase* the already-computed mismatch reason
// (Section 9.2) — never to decide it. Payment approval is handled by the later Phase 18 layer.
@Service
public class MatchingService {

    private final InvoiceRepository invoiceRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final GoodsReceiptRepository goodsReceiptRepository;
    private final PurchaseRequisitionRepository requisitionRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;
    private final MismatchExplanationService mismatchExplanationService;
    private final ThreeWayMatchEngine threeWayMatchEngine;

    public MatchingService(
            InvoiceRepository invoiceRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            GoodsReceiptRepository goodsReceiptRepository,
            ThreeWayMatchRepository threeWayMatchRepository,
            MismatchExplanationService mismatchExplanationService,
            java.math.BigDecimal quantityTolerancePct,
            java.math.BigDecimal priceTolerancePct) {
        this(invoiceRepository, purchaseOrderRepository, goodsReceiptRepository, null, threeWayMatchRepository,
                mismatchExplanationService, quantityTolerancePct, priceTolerancePct);
    }

    @Autowired
    public MatchingService(
            InvoiceRepository invoiceRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            GoodsReceiptRepository goodsReceiptRepository,
            PurchaseRequisitionRepository requisitionRepository,
            ThreeWayMatchRepository threeWayMatchRepository,
            MismatchExplanationService mismatchExplanationService,
            @Value("${pr2.matching.quantity-tolerance-pct:2}") java.math.BigDecimal quantityTolerancePct,
            @Value("${pr2.matching.price-tolerance-pct:2}") java.math.BigDecimal priceTolerancePct) {
        this.invoiceRepository = invoiceRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.goodsReceiptRepository = goodsReceiptRepository;
        this.requisitionRepository = requisitionRepository;
        this.threeWayMatchRepository = threeWayMatchRepository;
        this.mismatchExplanationService = mismatchExplanationService;
        this.threeWayMatchEngine = new ThreeWayMatchEngine(quantityTolerancePct, priceTolerancePct);
    }

    @Transactional
    public ThreeWayMatch runMatch(UUID invoiceId) {
        return runMatch(invoiceId, null);
    }

    @Transactional
    public ThreeWayMatch runMatch(UUID invoiceId, UUID poIdOverride) {
        Invoice invoice = invoiceRepository
                .findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));

        UUID effectivePoId = firstNonNull(invoice.getPoId(), poIdOverride);
        if (effectivePoId == null) {
            throw new BusinessRuleViolationException(
                    "Invoice " + invoiceId + " is not yet linked to a purchase order; pass poId in the match request body");
        }
        if (invoice.getQuantityOcr() == null || invoice.getUnitPriceOcr() == null) {
            throw new BusinessRuleViolationException(
                    "Invoice " + invoiceId + " is missing quantity/unit price — OCR extraction did not complete and no manual fields were supplied");
        }

        PurchaseOrder po = purchaseOrderRepository
                .findById(effectivePoId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + effectivePoId));
        if (invoice.getPoId() == null) {
            invoice.linkToPo(effectivePoId);
        }

        List<GoodsReceipt> receipts = goodsReceiptRepository.findByPoId(po.getId());
        if (receipts.isEmpty()) {
            throw new BusinessRuleViolationException("No goods receipt recorded yet for PO " + po.getId() + "; cannot match");
        }
        int totalReceivedQty = receipts.stream().mapToInt(GoodsReceipt::getReceivedQty).sum();
        UUID latestGrnId = receipts.stream()
                .max(Comparator.comparing(GoodsReceipt::getReceivedAt))
                .orElseThrow()
                .getId();

        PurchaseRequisition requisition = requisitionRepository == null
                ? null
                : requisitionRepository.findById(po.getRequisitionId()).orElse(null);
        String expectedSku = requisition == null ? null : requisition.getSkuCode();
        String invoiceSku = extractSku(invoice.getRawOcrJson());
        ThreeWayMatchEngine.MatchDecision decision = threeWayMatchEngine.match(po, totalReceivedQty, invoice, expectedSku, invoiceSku);
        String aiExplanation = decision.result() == MatchResult.MISMATCHED
                ? mismatchExplanationService.explain(decision.mismatchReason())
                : null;

        ThreeWayMatch match = new ThreeWayMatch(
                invoice.getId(),
                po.getId(),
                latestGrnId,
                decision.qtyMatch(),
                decision.priceMatch(),
                decision.result(),
                decision.mismatchReason(),
                aiExplanation);
        threeWayMatchRepository.save(match);

        if (decision.result() == MatchResult.MATCHED) {
            invoice.markMatched();
        } else {
            invoice.markMismatched();
        }
        invoiceRepository.save(invoice);

        return match;
    }

    private static String extractSku(String rawJson) {
        if (rawJson == null) return null;
        Matcher matcher = Pattern.compile("\\\"(?:skuCode|sku_code|sku)\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"", Pattern.CASE_INSENSITIVE)
                .matcher(rawJson);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static UUID firstNonNull(UUID first, UUID second) {
        return first != null ? first : second;
    }
}
