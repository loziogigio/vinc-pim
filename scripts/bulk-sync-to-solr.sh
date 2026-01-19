#!/bin/bash

# Bulk Sync Products to Solr via API
# Usage:
#   ./scripts/bulk-sync-to-solr.sh dfl-eventi-it
#   ./scripts/bulk-sync-to-solr.sh hidros-it

set -e

if [ -z "$1" ]; then
  echo ""
  echo "❌ Error: Tenant ID required"
  echo ""
  echo "Usage:"
  echo "  ./scripts/bulk-sync-to-solr.sh dfl-eventi-it"
  echo "  ./scripts/bulk-sync-to-solr.sh hidros-it"
  echo ""
  exit 1
fi

TENANT=$1
API_URL="${API_URL:-http://localhost:3001}"

# Get API credentials based on tenant
if [ "$TENANT" = "dfl-eventi-it" ]; then
  API_KEY_ID="ak_dfl-eventi-it_112233445566"
  API_SECRET="sk_112233445566778899aabbccddeeff00"
elif [ "$TENANT" = "hidros-it" ]; then
  API_KEY_ID="ak_hidros-it_aabbccddeeff"
  API_SECRET="sk_aabbccddeeff00112233445566778899"
else
  echo "❌ Unknown tenant: $TENANT"
  exit 1
fi

echo ""
echo "🔄 Bulk Syncing Products to Solr"
echo "🎯 Target tenant: $TENANT"
echo "📍 API URL: $API_URL"
echo ""

# Fetch all published products
echo "📦 Fetching published products..."
PRODUCTS=$(curl -s "$API_URL/api/b2b/pim/products?limit=1000&status=published" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: $API_KEY_ID" \
  -H "x-api-secret: $API_SECRET")

TOTAL=$(echo "$PRODUCTS" | jq -r '.pagination.total // 0')

if [ "$TOTAL" -eq 0 ]; then
  echo "ℹ️  No published products to sync"
  exit 0
fi

echo "✅ Found $TOTAL published products"
echo ""

# Extract entity codes
ENTITY_CODES=$(echo "$PRODUCTS" | jq -r '.products[].entity_code')

# Sync each product
SYNCED=0
FAILED=0
COUNT=0

for ENTITY_CODE in $ENTITY_CODES; do
  COUNT=$((COUNT + 1))
  PROGRESS="[$COUNT/$TOTAL]"

  # Get product name for display
  NAME=$(echo "$PRODUCTS" | jq -r ".products[] | select(.entity_code==\"$ENTITY_CODE\") | .name.it // .sku")

  printf "%s 🔄 Syncing %s (%s)..." "$PROGRESS" "$ENTITY_CODE" "$NAME"

  # Call sync API
  RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/b2b/pim/products/$ENTITY_CODE/sync" \
    -X POST \
    -H "x-auth-method: api-key" \
    -H "x-api-key-id: $API_KEY_ID" \
    -H "x-api-secret: $API_SECRET")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" -eq 200 ]; then
    SUCCESS=$(echo "$BODY" | jq -r '.success // false')
    if [ "$SUCCESS" = "true" ]; then
      echo " ✅"
      SYNCED=$((SYNCED + 1))
    else
      ERROR=$(echo "$BODY" | jq -r '.error // "Unknown error"')
      echo " ❌ $ERROR"
      FAILED=$((FAILED + 1))
    fi
  else
    ERROR=$(echo "$BODY" | jq -r '.error // "HTTP error"')
    echo " ❌ HTTP $HTTP_CODE: $ERROR"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "============================================================"
echo "📊 SUMMARY"
echo "============================================================"
echo "✅ Successfully synced: $SYNCED/$TOTAL"
if [ "$FAILED" -gt 0 ]; then
  echo "❌ Failed: $FAILED/$TOTAL"
fi
echo "============================================================"
echo ""

# Verify Solr count
echo "🔍 Verifying Solr index..."
SOLR_COUNT=$(curl -s "http://149.81.163.109:8983/solr/vinc-$TENANT/select?q=*:*&rows=0" | jq -r '.response.numFound')
echo "📊 Products in Solr: $SOLR_COUNT"
echo ""

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
