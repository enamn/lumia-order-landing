#!/bin/sh
# Sandbox only (BILLING_SANDBOX=true on the app): runs the billing job every 20 seconds so renewals, retries and emails happen on the short clock.
# Usage: INTERNAL_API_KEY=... APP_URL=http://localhost:3000 sh scripts/billing-sandbox.sh
: "${INTERNAL_API_KEY:?set INTERNAL_API_KEY}"
URL="${APP_URL:-http://localhost:3000}/api/internal/billing/run"
while true; do
  printf '%s ' "$(date +%T)"
  curl -s -X POST "$URL" -H "Authorization: Bearer $INTERNAL_API_KEY"; echo
  sleep 20
done
