#!/bin/bash

#########################################
# One-Command: Export Local → Import to Production
#########################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

LOCAL_DB="${1:-hdr-api-it}"
shift 2>/dev/null || true

# Parse all remaining arguments to pass to export script
ARGS=("$@")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Sync Local MongoDB to Production${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Source:${NC} localhost:27017/${LOCAL_DB}"
echo -e "${GREEN}Target:${NC} 149.81.163.109:27017/vinc_storefront"
echo ""

# Step 1: Export from local
echo -e "${YELLOW}Step 1/2: Exporting from local...${NC}"
./scripts/export-local-db.sh "$LOCAL_DB" "${ARGS[@]}"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Export failed!${NC}"
  exit 1
fi

# Get the latest export folder
LATEST_EXPORT=$(ls -1t mongodb-exports/ | grep -v "BACKUP_" | head -1)

echo ""
echo -e "${YELLOW}Step 2/2: Importing to production...${NC}"
echo ""

# Step 2: Import to production
./scripts/import-to-production.sh "$LATEST_EXPORT"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Sync completed successfully!${NC}"
  echo ""
else
  echo -e "${RED}❌ Sync failed!${NC}"
  exit 1
fi
