package com.chainvision.pr2.service;

import com.chainvision.pr2.dto.AnalyticsSummaryResponse;
import com.chainvision.pr2.entity.Invoice;
import com.chainvision.pr2.entity.InvoiceStatus;
import com.chainvision.pr2.entity.MatchResult;
import com.chainvision.pr2.entity.PaymentApproval;
import com.chainvision.pr2.entity.PaymentStatus;
import com.chainvision.pr2.entity.PurchaseOrderStatus;
import com.chainvision.pr2.entity.RequisitionStatus;
import com.chainvision.pr2.entity.ThreeWayMatch;
import com.chainvision.pr2.repository.InvoiceRepository;
import com.chainvision.pr2.repository.PaymentApprovalRepository;
import com.chainvision.pr2.repository.ThreeWayMatchRepository;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import com.chainvision.pr2.purchaseorder.PurchaseOrderRepository;
import com.chainvision.pr2.requisition.PurchaseRequisition;
import com.chainvision.pr2.requisition.PurchaseRequisitionRepository;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;

// GET /api/analytics/p2p-summary — Documentaion/00_PROJECT_CONTEXT.md Section 13.2 and Section 3
// ("A P2P analytics dashboard showing touchless-processing rate, PRs/POs/invoices in flight,
// exception rate, and cycle time"). Plain aggregation over already-persisted, deterministically
// computed records — no AI involved.
@Service
public class AnalyticsService {

    private final PurchaseRequisitionRepository requisitionRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final InvoiceRepository invoiceRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;
    private final PaymentApprovalRepository paymentApprovalRepository;

    public AnalyticsService(
            PurchaseRequisitionRepository requisitionRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            InvoiceRepository invoiceRepository,
            ThreeWayMatchRepository threeWayMatchRepository,
            PaymentApprovalRepository paymentApprovalRepository) {
        this.requisitionRepository = requisitionRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.invoiceRepository = invoiceRepository;
        this.threeWayMatchRepository = threeWayMatchRepository;
        this.paymentApprovalRepository = paymentApprovalRepository;
    }

    public AnalyticsSummaryResponse summarize() {
        List<PurchaseRequisition> requisitions = requisitionRepository.findAll();
        List<PurchaseOrder> purchaseOrders = purchaseOrderRepository.findAll();
        List<Invoice> invoices = invoiceRepository.findAll();
        List<ThreeWayMatch> matches = threeWayMatchRepository.findAll();
        List<PaymentApproval> payments = paymentApprovalRepository.findAll();

        long prsInFlight =
                requisitions.stream().filter(r -> r.getStatus() != RequisitionStatus.PO_RAISED).count();
        long posInFlight = purchaseOrders.stream()
                .filter(po -> po.getStatus() != PurchaseOrderStatus.RECEIVED && po.getStatus() != PurchaseOrderStatus.CLOSED)
                .count();
        long invoicesInFlight =
                invoices.stream().filter(i -> i.getStatus() != InvoiceStatus.APPROVED).count();

        double exceptionRatePct = matches.isEmpty()
                ? 0.0
                : 100.0 * matches.stream().filter(m -> m.getResult() == MatchResult.MISMATCHED).count() / matches.size();

        double touchlessRatePct = payments.isEmpty()
                ? 0.0
                : 100.0 * payments.stream().filter(p -> p.getStatus() == PaymentStatus.AUTO_APPROVED).count() / payments.size();

        Double avgCycleTimeHours = computeAvgCycleTimeHours(requisitions, purchaseOrders, invoices, payments);

        return new AnalyticsSummaryResponse(
                requisitions.size(),
                purchaseOrders.size(),
                invoices.size(),
                prsInFlight,
                posInFlight,
                invoicesInFlight,
                touchlessRatePct,
                exceptionRatePct,
                avgCycleTimeHours);
    }

    // Cycle time = time from requisition creation to payment approval, following
    // requisition -> PO -> invoice -> payment. Skips any payment whose chain can't be
    // fully resolved (shouldn't happen given the FK relationships, but defensive regardless).
    private Double computeAvgCycleTimeHours(
            List<PurchaseRequisition> requisitions,
            List<PurchaseOrder> purchaseOrders,
            List<Invoice> invoices,
            List<PaymentApproval> payments) {
        Map<UUID, PurchaseRequisition> requisitionsById = indexBy(requisitions, PurchaseRequisition::getId);
        Map<UUID, PurchaseOrder> purchaseOrdersById = indexBy(purchaseOrders, PurchaseOrder::getId);
        Map<UUID, Invoice> invoicesById = indexBy(invoices, Invoice::getId);

        List<Double> cycleHours = payments.stream()
                .filter(p -> p.getApprovedAt() != null)
                .map(p -> {
                    Invoice invoice = invoicesById.get(p.getInvoiceId());
                    if (invoice == null || invoice.getPoId() == null) {
                        return null;
                    }
                    PurchaseOrder po = purchaseOrdersById.get(invoice.getPoId());
                    if (po == null) {
                        return null;
                    }
                    PurchaseRequisition requisition = requisitionsById.get(po.getRequisitionId());
                    if (requisition == null) {
                        return null;
                    }
                    return Duration.between(requisition.getCreatedAt(), p.getApprovedAt()).toSeconds() / 3600.0;
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        return cycleHours.isEmpty() ? null : cycleHours.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private static <T> Map<UUID, T> indexBy(List<T> items, Function<T, UUID> idFn) {
        return items.stream().collect(java.util.stream.Collectors.toMap(idFn, Function.identity()));
    }
}
