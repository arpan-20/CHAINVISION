package com.chainvision.pr2.goodsreceipt;

import com.chainvision.pr2.entity.PurchaseOrderStatus;
import com.chainvision.pr2.exception.InvalidStateException;
import com.chainvision.pr2.exception.ResourceNotFoundException;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import com.chainvision.pr2.purchaseorder.PurchaseOrderRepository;
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

    // Simulated one-click receipt: persist the GRN, then set the PO status from cumulative
    // received quantity. No AI or IoT/CV integration is involved in this demo flow.
    @Transactional
    public GoodsReceipt recordReceipt(UUID poId, Integer receivedQty, String batchNo, LocalDate expiryDate) {
        PurchaseOrder po = purchaseOrderRepository
                .findById(poId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + poId));

        if (!RECEIVABLE_STATUSES.contains(po.getStatus())) {
            throw new InvalidStateException("Purchase order " + poId + " is " + po.getStatus() + "; cannot record a receipt");
        }

        GoodsReceipt grn = new GoodsReceipt(poId, receivedQty, batchNo, expiryDate);
        GoodsReceipt saved = goodsReceiptRepository.save(grn);

        int totalReceived = goodsReceiptRepository.findByPoId(poId).stream()
                .mapToInt(GoodsReceipt::getReceivedQty)
                .sum();

        if (totalReceived >= po.getQuantity()) {
            po.markReceived();
        } else {
            po.markPartiallyReceived();
        }
        purchaseOrderRepository.save(po);

        return saved;
    }

    public List<GoodsReceipt> listGoodsReceipts(UUID poId) {
        return poId != null ? goodsReceiptRepository.findByPoId(poId) : goodsReceiptRepository.findAll();
    }
}
