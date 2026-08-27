package com.chainvision.pr2.goodsreceipt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chainvision.pr2.entity.PurchaseOrderStatus;
import com.chainvision.pr2.purchaseorder.PurchaseOrder;
import com.chainvision.pr2.purchaseorder.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class GoodsReceiptServiceTest {

    private final GoodsReceiptRepository goodsReceiptRepository = Mockito.mock(GoodsReceiptRepository.class);
    private final PurchaseOrderRepository purchaseOrderRepository = Mockito.mock(PurchaseOrderRepository.class);

    private final GoodsReceiptService goodsReceiptService =
            new GoodsReceiptService(goodsReceiptRepository, purchaseOrderRepository);

    @Test
    void fullReceiptCreatesGrnAndMarksPurchaseOrderReceived() {
        UUID poId = UUID.randomUUID();
        PurchaseOrder po = purchaseOrder(poId, 500);

        when(purchaseOrderRepository.findById(poId)).thenReturn(Optional.of(po));
        when(goodsReceiptRepository.save(any(GoodsReceipt.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(goodsReceiptRepository.findByPoId(poId))
                .thenReturn(List.of());

        GoodsReceipt grn = goodsReceiptService.recordReceipt(poId, 500, "B100", LocalDate.parse("2027-06-01"));

        assertThat(grn.getPoId()).isEqualTo(poId);
        assertThat(grn.getReceivedQty()).isEqualTo(500);
        assertThat(po.getStatus()).isEqualTo(PurchaseOrderStatus.RECEIVED);
        verify(purchaseOrderRepository).save(po);
    }

    @Test
    void partialReceiptCreatesGrnAndMarksPurchaseOrderPartiallyReceived() {
        UUID poId = UUID.randomUUID();
        PurchaseOrder po = purchaseOrder(poId, 500);

        when(purchaseOrderRepository.findById(poId)).thenReturn(Optional.of(po));
        when(goodsReceiptRepository.save(any(GoodsReceipt.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(goodsReceiptRepository.findByPoId(poId))
                .thenReturn(List.of(new GoodsReceipt(poId, 200, "B101", LocalDate.parse("2027-06-01"))));

        GoodsReceipt grn = goodsReceiptService.recordReceipt(poId, 200, "B101", LocalDate.parse("2027-06-01"));

        assertThat(grn.getPoId()).isEqualTo(poId);
        assertThat(grn.getReceivedQty()).isEqualTo(200);
        assertThat(po.getStatus()).isEqualTo(PurchaseOrderStatus.PARTIALLY_RECEIVED);
        verify(purchaseOrderRepository).save(po);
    }

    private static PurchaseOrder purchaseOrder(UUID id, int quantity) {
        PurchaseOrder po = new PurchaseOrder(UUID.randomUUID(), UUID.randomUUID(), quantity, new BigDecimal("10.00"));
        ReflectionTestUtils.setField(po, "id", id);
        return po;
    }
}
