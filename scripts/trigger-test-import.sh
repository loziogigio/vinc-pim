#!/bin/bash

# Trigger Test Import for API Source
#
# This script triggers an API import for the configured source

SOURCE_ID="api-supplier-1"
API_URL="http://localhost:3000/api/b2b/pim/sources/$SOURCE_ID/trigger"

echo "🚀 Triggering import for source: $SOURCE_ID"
echo "   API: $API_URL"
echo ""

response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

echo "Response ($http_code):"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" = "200" ]; then
  job_id=$(echo "$body" | jq -r '.job_id' 2>/dev/null)
  echo "✅ Import triggered successfully!"
  echo "   Job ID: $job_id"
  echo ""
  echo "📊 Monitor progress:"
  echo "   http://localhost:3000/api/admin/bull-board"
  echo ""
  echo "⚠️  Make sure the worker is running:"
  echo "   pnpm worker:pim"
else
  echo "❌ Failed to trigger import"
  echo "   Check that:"
  echo "   1. The Next.js server is running (pnpm dev)"
  echo "   2. The source has API configuration"
  echo "   3. MongoDB is accessible"
fi
