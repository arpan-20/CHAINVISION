package com.chainvision.pr2.payment;

import com.chainvision.pr2.dto.ExceptionResponse;
import com.chainvision.pr2.dto.InvoiceResponse;
import com.chainvision.pr2.dto.PaymentApprovalResponse;
import com.chainvision.pr2.dto.ThreeWayMatchResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exceptions")
public class PaymentApprovalController {

    private final PaymentApprovalService paymentApprovalService;

    public PaymentApprovalController(PaymentApprovalService paymentApprovalService) {
        this.paymentApprovalService = paymentApprovalService;
    }

    @GetMapping
    public List<ExceptionResponse> list() {
        return paymentApprovalService.listExceptions().stream()
                .map(item -> ExceptionResponse.of(
                        InvoiceResponse.from(item.invoice()),
                        PaymentApprovalResponse.from(item.paymentApproval()),
                        item.latestMatch() != null ? ThreeWayMatchResponse.from(item.latestMatch()) : null))
                .toList();
    }

    @PostMapping("/{id}/resolve")
    public PaymentApprovalResponse resolve(
            @PathVariable UUID id, @Valid @RequestBody ResolvePaymentApprovalRequest request) {
        return PaymentApprovalResponse.from(
                paymentApprovalService.resolve(id, request.decision(), request.approvedBy()));
    }
}
