package com.chainvision.pr2.service;

import com.chainvision.pr2.entity.GoodsReceipt;
import com.chainvision.pr2.entity.PurchaseOrder;
import com.chainvision.pr2.entity.PurchaseOrderStatus;
import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.repository.GoodsReceiptRepository;
import com.chainvision.pr2.repository.PurchaseOrderRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoodsReceiptService {

    private static final Set<PurchaseOrderStatus> RECEIVABLE_STATUSES =
            Set.of(PurchaseOrderStatus.ISSUED, PurchaseOrderStatus.ACKNOWLEDGED, PurchaseOrderStatus.PARTIALLY_RECEIVED);

    private final GoodsReceiptRepository goodsReceiptRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public GoodsReceiptService(
            GoodsReceiptRepository goodsReceiptRepository, PurchaseOrderRepository purchaseOrderRepository) {
        this.goodsReceiptRepository = goodsReceiptRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    // Simulates goods receipt against a PO (Documentaion/00_PROJECT_CONTEXT.md Section 3,
    // "Receiving") and rolls the PO's status forward — PARTIALLY_RECEIVED if cumulative received
    // quantity is still short of what was ordered, RECEIVED once it's met or exceeded.
    @Transactional
    public GoodsReceipt recordReceipt(UUID poId, Integer receivedQty, String batchNo, LocalDate expiryDate) {
        PurchaseOrder po = purchaseOrderRepository
                .findById(poId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + poId));

        if (!RECEIVABLE_STATUSES.contains(po.getStatus())) {
            throw new InvalidStateException("Purchase order " + poId + " is " + po.getStatus() + "; cannot record a receipt");
        }

        GoodsReceipt grn = new GoodsReceipt(poId, receivedQty, batchNo, expiryDate);
        goodsReceiptRepository.save(grn);

        int totalReceived = goodsReceiptRepository.findByPoId(poId).stream()
                .mapToInt(GoodsReceipt::getReceivedQty)
                .sum();

        if (totalReceived >= po.getQuantity()) {
            po.markReceived();
        } else {
            po.markPartiallyReceived();
        }
        purchaseOrderRepository.save(po);

        return grn;
    }

    public List<GoodsReceipt> listGoodsReceipts(UUID poId) {
        return poId != null ? goodsReceiptRepository.findByPoId(poId) : goodsReceiptRepository.findAll();
    }
}
