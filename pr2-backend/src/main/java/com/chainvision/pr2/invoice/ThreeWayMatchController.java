package com.chainvision.pr2.invoice;

import com.chainvision.pr2.dto.ThreeWayMatchResponse;
import com.chainvision.pr2.service.MatchingService;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ThreeWayMatchController {

    private final MatchingService matchingService;

    public ThreeWayMatchController(MatchingService matchingService) {
        this.matchingService = matchingService;
    }

    @PostMapping("/api/invoices/{id}/match")
    public ThreeWayMatchResponse match(@PathVariable UUID id, @RequestBody(required = false) MatchRequest request) {
        UUID poId = request == null ? null : request.poId();
        return ThreeWayMatchResponse.from(matchingService.runMatch(id, poId));
    }

    public record MatchRequest(UUID poId) {
    }
}
