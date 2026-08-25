package com.chainvision.pr2.goodsreceipt;

import com.chainvision.pr2.dto.CreateGoodsReceiptRequest;
import com.chainvision.pr2.dto.GoodsReceiptResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
@RestController
@RequestMapping("/api/goods-receipts")
public class GoodsReceiptController {

    private final GoodsReceiptService goodsReceiptService;

    public GoodsReceiptController(GoodsReceiptService goodsReceiptService) {
        this.goodsReceiptService = goodsReceiptService;
    }

    @PostMapping
    public ResponseEntity<GoodsReceiptResponse> create(@Valid @RequestBody CreateGoodsReceiptRequest request) {
        GoodsReceipt grn = goodsReceiptService.recordReceipt(
                request.poId(), request.receivedQty(), request.batchNo(), request.expiryDate());
        GoodsReceiptResponse body = GoodsReceiptResponse.from(grn);
        return ResponseEntity.created(URI.create("/api/goods-receipts/" + body.id())).body(body);
    }

    @GetMapping
    public List<GoodsReceiptResponse> list(@RequestParam(required = false) UUID poId) {
        return goodsReceiptService.listGoodsReceipts(poId).stream().map(GoodsReceiptResponse::from).toList();
    }
}
