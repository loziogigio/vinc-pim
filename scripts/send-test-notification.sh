#!/bin/bash
# Send test notification to yiresse.abia@gmail.com every 15 minutes
# Usage: Add to crontab: */15 * * * * /path/to/send-test-notification.sh

API_URL="https://cs.vendereincloud.it/api/b2b/notifications/campaigns"
API_KEY_ID="ak_hidros-it_aabbccddeeff"
API_SECRET="sk_aabbccddeeff00112233445566778899"
PORTAL_USER_ID="PU-jXoKbsPI"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Create and send campaign
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: $API_KEY_ID" \
  -H "x-api-secret: $API_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Timer - $TIMESTAMP\",
    \"type\": \"generic\",
    \"title\": \"Notifica Test Periodica\",
    \"body\": \"Test notification sent at $TIMESTAMP\",
    \"channels\": [\"email\", \"web_in_app\"],
    \"recipient_type\": \"selected\",
    \"selected_user_ids\": [\"$PORTAL_USER_ID\"],
    \"url\": \"https://cs.vendereincloud.it/\"
  }")

CAMPAIGN_ID=$(echo "$RESPONSE" | jq -r '.campaign.campaign_id')

if [ "$CAMPAIGN_ID" != "null" ] && [ -n "$CAMPAIGN_ID" ]; then
  # Send the campaign
  SEND_RESPONSE=$(curl -s -X POST "$API_URL/$CAMPAIGN_ID/send" \
    -H "x-auth-method: api-key" \
    -H "x-api-key-id: $API_KEY_ID" \
    -H "x-api-secret: $API_SECRET" \
    -H "Content-Type: application/json")

  echo "[$TIMESTAMP] Campaign $CAMPAIGN_ID sent: $SEND_RESPONSE"
else
  echo "[$TIMESTAMP] Failed to create campaign: $RESPONSE"
fi
