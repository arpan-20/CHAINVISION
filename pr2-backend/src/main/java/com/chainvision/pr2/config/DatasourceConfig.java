package com.chainvision.pr2.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class DatasourceConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatasourceConfig.class);

    @Bean
    ApplicationRunner verifyDatasource(JdbcTemplate jdbcTemplate) {
        return args -> {
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            if (!Integer.valueOf(1).equals(result)) {
                throw new IllegalStateException("Datasource connectivity check returned an unexpected result");
            }
            LOGGER.info("Supabase Postgres datasource connectivity check passed");
        };
    }
}