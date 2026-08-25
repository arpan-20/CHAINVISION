package com.chainvision.pr2.controller;

import com.chainvision.pr2.dto.AnalyticsSummaryResponse;
import com.chainvision.pr2.service.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/p2p-summary")
    public AnalyticsSummaryResponse summary() {
        return analyticsService.summarize();
    }
}
