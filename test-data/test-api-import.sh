#!/bin/bash

# Test API Import Endpoint
# This script demonstrates how to import products via API request instead of file upload

API_URL="http://localhost:3000/api/b2b/pim/import/api"

echo "🚀 Testing API Product Import"
echo "================================"
echo ""
echo "Sending request to: $API_URL"
echo ""

# Make the API call
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d @test-data/api-import-example.json \
  -w "\n\n⏱️  Response Time: %{time_total}s\n" \
  | jq '.'

echo ""
echo "================================"
echo "✅ Test completed!"
echo ""
echo "Check the results at: http://localhost:3000/b2b/pim/jobs"
echo ""
