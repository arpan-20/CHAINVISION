package com.chainvision.pr2.service;

import com.chainvision.pr2.ai.MismatchExplanationService;
import com.chainvision.pr2.entity.GoodsReceipt;
import com.chainvision.pr2.entity.Invoice;
import com.chainvision.pr2.entity.MatchResult;
import com.chainvision.pr2.entity.PaymentApproval;
import com.chainvision.pr2.entity.PaymentStatus;
import com.chainvision.pr2.entity.PurchaseOrder;
import com.chainvision.pr2.entity.ThreeWayMatch;
import com.chainvision.pr2.exception.BusinessRuleViolationException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.repository.GoodsReceiptRepository;
import com.chainvision.pr2.repository.InvoiceRepository;
import com.chainvision.pr2.repository.PaymentApprovalRepository;
import com.chainvision.pr2.repository.PurchaseOrderRepository;
import com.chainvision.pr2.repository.ThreeWayMatchRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The deterministic 3-way match — Documentaion/00_PROJECT_CONTEXT.md Section 3 ("Invoicing") and
// Section 5.1's hard rule: this is plain arithmetic against configurable tolerances, never an LLM
// decision. On MATCHED, payment is auto-approved immediately (Section 3). On MISMATCHED, the
// invoice moves into the exception queue (surfaced by ExceptionService) and Gemini is asked only
// to *phrase* the already-computed mismatch reason (Section 9.2) — never to decide it.
@Service
public class MatchingService {

    private final InvoiceRepository invoiceRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final GoodsReceiptRepository goodsReceiptRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;
    private final PaymentApprovalRepository paymentApprovalRepository;
    private final MismatchExplanationService mismatchExplanationService;
    private final BigDecimal quantityTolerancePct;
    private final BigDecimal priceTolerancePct;

    public MatchingService(
            InvoiceRepository invoiceRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            GoodsReceiptRepository goodsReceiptRepository,
            ThreeWayMatchRepository threeWayMatchRepository,
            PaymentApprovalRepository paymentApprovalRepository,
            MismatchExplanationService mismatchExplanationService,
            @Value("${pr2.matching.quantity-tolerance-pct:2}") BigDecimal quantityTolerancePct,
            @Value("${pr2.matching.price-tolerance-pct:2}") BigDecimal priceTolerancePct) {
        this.invoiceRepository = invoiceRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.goodsReceiptRepository = goodsReceiptRepository;
        this.threeWayMatchRepository = threeWayMatchRepository;
        this.paymentApprovalRepository = paymentApprovalRepository;
        this.mismatchExplanationService = mismatchExplanationService;
        this.quantityTolerancePct = quantityTolerancePct;
        this.priceTolerancePct = priceTolerancePct;
    }

    @Transactional
    public ThreeWayMatch runMatch(UUID invoiceId) {
        Invoice invoice = invoiceRepository
                .findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));

        if (invoice.getPoId() == null) {
            throw new BusinessRuleViolationException("Invoice " + invoiceId + " is not yet linked to a purchase order (poId)");
        }
        if (invoice.getQuantityOcr() == null || invoice.getUnitPriceOcr() == null) {
            throw new BusinessRuleViolationException(
                    "Invoice " + invoiceId + " is missing quantity/unit price — OCR extraction did not complete and no manual fields were supplied");
        }

        PurchaseOrder po = purchaseOrderRepository
                .findById(invoice.getPoId())
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + invoice.getPoId()));

        List<GoodsReceipt> receipts = goodsReceiptRepository.findByPoId(po.getId());
        if (receipts.isEmpty()) {
            throw new BusinessRuleViolationException("No goods receipt recorded yet for PO " + po.getId() + "; cannot match");
        }
        int totalReceivedQty = receipts.stream().mapToInt(GoodsReceipt::getReceivedQty).sum();
        UUID latestGrnId = receipts.stream()
                .max(Comparator.comparing(GoodsReceipt::getReceivedAt))
                .orElseThrow()
                .getId();

        boolean qtyMatch = withinTolerance(
                BigDecimal.valueOf(invoice.getQuantityOcr()), BigDecimal.valueOf(totalReceivedQty), quantityTolerancePct);
        boolean priceMatch = withinTolerance(invoice.getUnitPriceOcr(), po.getUnitPrice(), priceTolerancePct);

        MatchResult result = (qtyMatch && priceMatch) ? MatchResult.MATCHED : MatchResult.MISMATCHED;
        String mismatchReason = result == MatchResult.MISMATCHED
                ? buildMismatchReason(invoice, totalReceivedQty, po, qtyMatch, priceMatch)
                : null;
        String aiExplanation = mismatchReason != null ? mismatchExplanationService.explain(mismatchReason) : null;

        ThreeWayMatch match = new ThreeWayMatch(
                invoice.getId(), po.getId(), latestGrnId, qtyMatch, priceMatch, result, mismatchReason, aiExplanation);
        threeWayMatchRepository.save(match);

        if (result == MatchResult.MATCHED) {
            invoice.markMatched();
            paymentApprovalRepository.save(
                    new PaymentApproval(invoice.getId(), PaymentStatus.AUTO_APPROVED, "system", OffsetDateTime.now()));
            invoice.markApproved();
        } else {
            invoice.markException();
        }
        invoiceRepository.save(invoice);

        return match;
    }

    private boolean withinTolerance(BigDecimal actual, BigDecimal expected, BigDecimal tolerancePct) {
        if (expected.compareTo(BigDecimal.ZERO) == 0) {
            return actual.compareTo(BigDecimal.ZERO) == 0;
        }
        BigDecimal diffPct = actual.subtract(expected)
                .abs()
                .divide(expected, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
        return diffPct.compareTo(tolerancePct) <= 0;
    }

    private String buildMismatchReason(
            Invoice invoice, int totalReceivedQty, PurchaseOrder po, boolean qtyMatch, boolean priceMatch) {
        StringBuilder reason = new StringBuilder();
        if (!qtyMatch) {
            reason.append("Invoice quantity (%d) does not match goods received (%d) — exceeds %s%% tolerance."
                    .formatted(invoice.getQuantityOcr(), totalReceivedQty, quantityTolerancePct));
        }
        if (!priceMatch) {
            if (!reason.isEmpty()) {
                reason.append(' ');
            }
            reason.append(
                    "Invoice unit price (%s) does not match PO unit price (%s) — exceeds %s%% tolerance."
                            .formatted(invoice.getUnitPriceOcr(), po.getUnitPrice(), priceTolerancePct));
        }
        return reason.toString();
    }
}
