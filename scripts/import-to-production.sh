#!/bin/bash

#########################################
# Import MongoDB Collections to Production
#########################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROD_MONGO_HOST="${PROD_MONGO_HOST:-149.81.163.109}"
PROD_MONGO_PORT="${PROD_MONGO_PORT:-27017}"
PROD_MONGO_USER="${PROD_MONGO_USER:-root}"
PROD_MONGO_PASS="${PROD_MONGO_PASS:-root}"
PROD_DB_NAME="${PROD_DB_NAME:-hdr-api-it}"

EXPORT_DIR="./mongodb-exports"
IMPORT_FOLDER="${1}"

if [ -z "$IMPORT_FOLDER" ]; then
  echo -e "${RED}❌ Error: No export folder specified${NC}"
  echo ""
  echo "Usage: $0 <export-folder>"
  echo ""
  echo "Available exports:"
  ls -1 "${EXPORT_DIR}" 2>/dev/null || echo "  No exports found"
  exit 1
fi

IMPORT_PATH="${EXPORT_DIR}/${IMPORT_FOLDER}"

if [ ! -d "$IMPORT_PATH" ]; then
  echo -e "${RED}❌ Error: Export folder not found: ${IMPORT_PATH}${NC}"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MongoDB Production Import Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Import from:${NC} ${IMPORT_PATH}"
echo -e "${GREEN}Target DB:${NC} ${PROD_DB_NAME}"
echo -e "${GREEN}Target Host:${NC} ${PROD_MONGO_HOST}:${PROD_MONGO_PORT}"
echo ""

# Show manifest if exists
if [ -f "${IMPORT_PATH}/manifest.txt" ]; then
  echo -e "${YELLOW}📋 Export Manifest:${NC}"
  cat "${IMPORT_PATH}/manifest.txt" | sed 's/^/   /'
  echo ""
fi

# Confirmation prompt
read -p "⚠️  Do you want to import to PRODUCTION? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
  echo -e "${YELLOW}Import cancelled.${NC}"
  exit 0
fi

# Backup production database first
echo -e "${YELLOW}📦 Creating backup of production database first...${NC}"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${EXPORT_DIR}/BACKUP_${PROD_DB_NAME}_${BACKUP_TIMESTAMP}"

# Create backup directory with proper permissions
mkdir -p "${BACKUP_PATH}"

docker run --rm \
  --network host \
  -u "$(id -u):$(id -g)" \
  -v "$(pwd)/${EXPORT_DIR}:/backup" \
  mongo:7 \
  mongodump \
  --host="${PROD_MONGO_HOST}" \
  --port="${PROD_MONGO_PORT}" \
  --username="${PROD_MONGO_USER}" \
  --password="${PROD_MONGO_PASS}" \
  --authenticationDatabase=admin \
  --db="${PROD_DB_NAME}" \
  --out="/backup/BACKUP_${PROD_DB_NAME}_${BACKUP_TIMESTAMP}"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Backup created: ${BACKUP_PATH}${NC}"
  echo ""
else
  echo -e "${RED}❌ Backup failed! Aborting import.${NC}"
  exit 1
fi

# Import to production
echo -e "${YELLOW}📥 Importing to production...${NC}"

# Get the source database name from the export folder structure
SOURCE_DB=$(ls -1 "${IMPORT_PATH}" | grep -v "manifest.txt" | head -1)

docker run --rm \
  --network host \
  -u "$(id -u):$(id -g)" \
  -v "$(pwd)/${EXPORT_DIR}:/backup" \
  mongo:7 \
  mongorestore \
  --host="${PROD_MONGO_HOST}" \
  --port="${PROD_MONGO_PORT}" \
  --username="${PROD_MONGO_USER}" \
  --password="${PROD_MONGO_PASS}" \
  --authenticationDatabase=admin \
  --db="${PROD_DB_NAME}" \
  --drop \
  "/backup/${IMPORT_FOLDER}/${SOURCE_DB}"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Import completed successfully!${NC}"
  echo ""
  echo -e "${GREEN}Imported to:${NC} ${PROD_MONGO_HOST}:${PROD_MONGO_PORT}/${PROD_DB_NAME}"
  echo -e "${GREEN}Backup saved:${NC} ${BACKUP_PATH}"
  echo ""
  echo -e "${YELLOW}💡 If you need to rollback, run:${NC}"
  echo -e "   ./scripts/rollback-production.sh BACKUP_${PROD_DB_NAME}_${BACKUP_TIMESTAMP}"
  echo ""
else
  echo -e "${RED}❌ Import failed!${NC}"
  echo -e "${YELLOW}Your production database backup is safe at: ${BACKUP_PATH}${NC}"
  exit 1
fi
