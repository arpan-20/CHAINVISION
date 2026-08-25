package com.chainvision.pr2.ai;

// Thrown when a Gemini call can't be completed (no API key configured, or
// the call itself failed/timed out/returned something unparseable).
// Callers decide whether to fall back to a manual/template path or surface
// a 503 — see Documentaion/00_PROJECT_CONTEXT.md Section 5.7 on defensive parsing.
public class GeminiUnavailableException extends RuntimeException {

    public GeminiUnavailableException(String message) {
        super(message);
    }

    public GeminiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
