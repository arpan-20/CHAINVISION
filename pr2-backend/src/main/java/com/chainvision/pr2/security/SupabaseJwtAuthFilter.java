package com.chainvision.pr2.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates Supabase access tokens using the configured Supabase JWKS.
 * The decoder also validates standard time claims and the Supabase issuer.
 */
@Component
public class SupabaseJwtAuthFilter extends OncePerRequestFilter {

    private static final String INTERNAL_RECOMMENDATION_PATH = "/api/requisitions/from-recommendation";
    private static final Logger logger = LoggerFactory.getLogger(SupabaseJwtAuthFilter.class);

    private final JwtDecoder jwtDecoder;
    private final JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();

    public SupabaseJwtAuthFilter(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return !path.startsWith("/api/")
                || ("POST".equalsIgnoreCase(request.getMethod()) && INTERNAL_RECOMMENDATION_PATH.equals(path));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) {
            unauthorized(response, "Bearer token is required");
            return;
        }

        try {
            Jwt jwt = jwtDecoder.decode(token);
            AbstractAuthenticationToken authentication = authenticationConverter.convert(jwt);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (JwtException exception) {
            logger.warn("Supabase JWT validation failed: {}", exception.getMessage());
            SecurityContextHolder.clearContext();
            unauthorized(response, "Invalid or expired Supabase access token");
        }
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"" + message + "\"}}");
    }
}
