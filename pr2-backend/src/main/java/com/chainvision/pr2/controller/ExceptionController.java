package com.chainvision.pr2.controller;

import com.chainvision.pr2.dto.ExceptionResponse;
import com.chainvision.pr2.dto.InvoiceResponse;
import com.chainvision.pr2.dto.PaymentApprovalResponse;
import com.chainvision.pr2.dto.ResolveExceptionRequest;
import com.chainvision.pr2.dto.ThreeWayMatchResponse;
import com.chainvision.pr2.entity.ThreeWayMatch;
import com.chainvision.pr2.service.ExceptionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// See Documentaion/00_PROJECT_CONTEXT.md Section 13.2.
@RestController
@RequestMapping("/api/exceptions")
public class ExceptionController {

    private final ExceptionService exceptionService;

    public ExceptionController(ExceptionService exceptionService) {
        this.exceptionService = exceptionService;
    }

    @GetMapping
    public List<ExceptionResponse> list() {
        return exceptionService.listActiveExceptions().stream()
                .map(invoice -> {
                    ThreeWayMatch match = exceptionService.latestMatchFor(invoice.getId());
                    return ExceptionResponse.of(
                            InvoiceResponse.from(invoice), match != null ? ThreeWayMatchResponse.from(match) : null);
                })
                .toList();
    }

    @PostMapping("/{id}/resolve")
    public PaymentApprovalResponse resolve(@PathVariable UUID id, @Valid @RequestBody ResolveExceptionRequest request) {
        return PaymentApprovalResponse.from(exceptionService.resolve(id, request.action(), request.resolvedBy()));
    }
}
