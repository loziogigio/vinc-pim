#!/bin/bash

#########################################
# Rollback Production Database
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
PROD_DB_NAME="${PROD_DB_NAME:-vinc_storefront}"

EXPORT_DIR="./mongodb-exports"
BACKUP_FOLDER="${1}"

if [ -z "$BACKUP_FOLDER" ]; then
  echo -e "${RED}❌ Error: No backup folder specified${NC}"
  echo ""
  echo "Usage: $0 <backup-folder>"
  echo ""
  echo "Available backups:"
  ls -1 "${EXPORT_DIR}" | grep "^BACKUP_" 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_PATH="${EXPORT_DIR}/${BACKUP_FOLDER}"

if [ ! -d "$BACKUP_PATH" ]; then
  echo -e "${RED}❌ Error: Backup folder not found: ${BACKUP_PATH}${NC}"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MongoDB Production Rollback Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Backup from:${NC} ${BACKUP_PATH}"
echo -e "${GREEN}Target DB:${NC} ${PROD_DB_NAME}"
echo -e "${GREEN}Target Host:${NC} ${PROD_MONGO_HOST}:${PROD_MONGO_PORT}"
echo ""

# Confirmation prompt
read -p "⚠️  Do you want to ROLLBACK production database? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
  echo -e "${YELLOW}Rollback cancelled.${NC}"
  exit 0
fi

# Restore from backup
echo -e "${YELLOW}📥 Rolling back production database...${NC}"

# Get the database name from the backup folder structure
SOURCE_DB=$(ls -1 "${BACKUP_PATH}" | head -1)

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
  "/backup/${BACKUP_FOLDER}/${SOURCE_DB}"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Rollback completed successfully!${NC}"
  echo ""
  echo -e "${GREEN}Database restored from:${NC} ${BACKUP_PATH}"
  echo ""
else
  echo -e "${RED}❌ Rollback failed!${NC}"
  exit 1
fi
