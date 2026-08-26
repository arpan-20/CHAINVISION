#!/usr/bin/env bash
# Launch PR2 backend with env vars parsed from the repo-root .env (BOM-safe).
set -u
cd "$(dirname "$0")/.."

export JAVA_HOME='C:\Program Files\Java\jdk-25.0.3'

getenv() {
  # strip BOM, CR, take value after first '='
  grep "^${1}=" .env | head -1 | sed 's/^\xEF\xBB\xBF//' | tr -d '\r' | cut -d= -f2-
}

SUPABASE_URL_VAL="$(getenv SUPABASE_URL)"
export SPRING_DATASOURCE_URL="$(getenv SPRING_DATASOURCE_URL)"
export SPRING_DATASOURCE_USERNAME="$(getenv SPRING_DATASOURCE_USERNAME)"
export SPRING_DATASOURCE_PASSWORD="$(getenv SPRING_DATASOURCE_PASSWORD)"
export SUPABASE_ISSUER_URI="${SUPABASE_URL_VAL}/auth/v1"
export SUPABASE_JWK_SET_URI="${SUPABASE_URL_VAL}/auth/v1/.well-known/jwks.json"
export INTERNAL_API_KEY="$(getenv INTERNAL_API_KEY)"
export GEMINI_API_KEY="$(getenv GEMINI_API_KEY)"

cd pr2-backend
exec ./mvnw.cmd -q spring-boot:run
