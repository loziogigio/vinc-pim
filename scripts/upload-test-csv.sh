#!/bin/bash

# Upload test CSV via import API

echo "📤 Uploading test CSV via import API..."
echo ""

CSV_FILE="../test-10-products.csv"
SOURCE_ID="test-default-lang"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"
UPLOAD_URL="${API_URL}/api/b2b/pim/import"

if [ ! -f "$CSV_FILE" ]; then
  echo "❌ CSV file not found: $CSV_FILE"
  exit 1
fi

echo "✅ Found CSV file: $CSV_FILE"
echo "📡 Uploading to: $UPLOAD_URL"
echo "   Source ID: $SOURCE_ID"
echo ""

# Upload using curl
RESPONSE=$(curl -s -X POST \
  -F "file=@${CSV_FILE}" \
  -F "source_id=${SOURCE_ID}" \
  "${UPLOAD_URL}")

echo "📦 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Upload complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Monitor import worker logs"
echo "   2. Check job status in the response above"
echo "   3. Verify products with: npx tsx scripts/check-test-products.ts"
