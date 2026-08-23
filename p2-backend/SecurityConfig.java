package com.chainvision.pr2.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

// TEMPORARY scaffold-only config. spring-boot-starter-security secures every
// endpoint by default, which would make GET /health return 401 instead of
// the required 200. This permits all requests so the Phase 1 health check
// works; real JWT verification rules replace this entirely in Phase 23
// (see 00_PROJECT_CONTEXT.md Section 11) — do not build on top of this,
// just replace it.
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
