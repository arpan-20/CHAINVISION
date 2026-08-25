package com.chainvision.pr2.invoice;

import com.chainvision.pr2.dto.ThreeWayMatchResponse;
import com.chainvision.pr2.payment.PaymentApprovalService;
import com.chainvision.pr2.service.MatchingService;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ThreeWayMatchController {

    private final MatchingService matchingService;
    private final PaymentApprovalService paymentApprovalService;

    public ThreeWayMatchController(MatchingService matchingService, PaymentApprovalService paymentApprovalService) {
        this.matchingService = matchingService;
        this.paymentApprovalService = paymentApprovalService;
    }

    @PostMapping("/api/invoices/{id}/match")
    public ThreeWayMatchResponse match(@PathVariable UUID id, @RequestBody(required = false) MatchRequest request) {
        UUID poId = request == null ? null : request.poId();
        ThreeWayMatch match = matchingService.runMatch(id, poId);
        paymentApprovalService.processMatchResult(id, match.getResult());
        return ThreeWayMatchResponse.from(match);
    }

    public record MatchRequest(UUID poId) {
    }
}
