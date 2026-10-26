#!/bin/bash
# Checks whether your Stripe account accepts a currency, using a TEST-mode PaymentIntent that is cancelled right after.
# Usage: ./stripe-currency-check.sh sar      (also: omr bhd qar kwd)
# It stops if the key is not a test key. The key is read from Secret Manager and never printed.
set -e
CUR="${1:-sar}"
K=$(gcloud secrets versions access latest --secret=lumia-stripe-secret-key --project=e-commerce-8000c)
case "$K" in
  sk_test_*) echo "Key mode: test" ;;
  *) echo "This is not a test key. Stopping."; exit 1 ;;
esac
echo "--- Stripe account"
curl -s https://api.stripe.com/v1/account -u "$K:" | python3 -c "import sys,json;d=json.load(sys.stdin);print('country:',d.get('country'),'| settles in:',d.get('default_currency'),d.get('error',{}).get('message',''))"
echo "--- Test charge in $CUR"
R=$(curl -s https://api.stripe.com/v1/payment_intents -u "$K:" -d amount=10000 -d currency="$CUR" -d "automatic_payment_methods[enabled]=true" -d "metadata[purpose]=currency check, cancelled right after")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print('result:',d.get('status') or 'REFUSED','|',d.get('error',{}).get('message','accepted'))"
ID=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
if [ -n "$ID" ]; then curl -s -X POST "https://api.stripe.com/v1/payment_intents/$ID/cancel" -u "$K:" >/dev/null && echo "Test charge cancelled."; fi
