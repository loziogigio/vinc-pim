#!/bin/bash

#########################################
# Export MongoDB Collections from Local
#########################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
LOCAL_MONGO_HOST="localhost"
LOCAL_MONGO_PORT="27017"
LOCAL_MONGO_USER="root"
LOCAL_MONGO_PASS="root"
LOCAL_DB_NAME="${1:-hdr-api-it}"

# Parse arguments
shift 2>/dev/null || true
EXCLUDE_MODE=false
COLLECTIONS=()
EXCLUDE_COLLECTIONS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --exclude)
      EXCLUDE_MODE=true
      shift
      ;;
    *)
      if [ "$EXCLUDE_MODE" = true ]; then
        EXCLUDE_COLLECTIONS+=("$1")
      else
        COLLECTIONS+=("$1")
      fi
      shift
      ;;
  esac
done

EXPORT_DIR="./mongodb-exports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_PATH="${EXPORT_DIR}/${LOCAL_DB_NAME}_${TIMESTAMP}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MongoDB Local Export Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Database:${NC} ${LOCAL_DB_NAME}"

if [ ${#EXCLUDE_COLLECTIONS[@]} -gt 0 ]; then
  echo -e "${RED}Excluding:${NC} ${EXCLUDE_COLLECTIONS[*]}"
  echo -e "${YELLOW}Mode:${NC} All collections except excluded"
elif [ ${#COLLECTIONS[@]} -gt 0 ]; then
  echo -e "${GREEN}Collections:${NC} ${COLLECTIONS[*]}"
  echo -e "${YELLOW}Mode:${NC} Specific collections only"
else
  echo -e "${YELLOW}Mode:${NC} Full database export"
fi

echo -e "${GREEN}Export to:${NC} ${EXPORT_PATH}"
echo ""

# Create export directory
mkdir -p "${EXPORT_PATH}"

# Build exclude parameters for mongodump
EXCLUDE_PARAMS=""
for excl_coll in "${EXCLUDE_COLLECTIONS[@]}"; do
  EXCLUDE_PARAMS="$EXCLUDE_PARAMS --excludeCollection=$excl_coll"
done

# Export using Docker with MongoDB tools
if [ ${#COLLECTIONS[@]} -gt 0 ]; then
  # Export specific collections
  echo -e "${YELLOW}📦 Exporting ${#COLLECTIONS[@]} collection(s)...${NC}"

  for collection in "${COLLECTIONS[@]}"; do
    echo -e "${BLUE}  → ${collection}${NC}"

    docker run --rm \
      --network host \
      -u "$(id -u):$(id -g)" \
      -v "$(pwd)/${EXPORT_DIR}:/backup" \
      mongo:7 \
      mongodump \
      --host="${LOCAL_MONGO_HOST}" \
      --port="${LOCAL_MONGO_PORT}" \
      --username="${LOCAL_MONGO_USER}" \
      --password="${LOCAL_MONGO_PASS}" \
      --authenticationDatabase=admin \
      --db="${LOCAL_DB_NAME}" \
      --collection="${collection}" \
      --out="/backup/${LOCAL_DB_NAME}_${TIMESTAMP}"
  done
elif [ ${#EXCLUDE_COLLECTIONS[@]} -gt 0 ]; then
  # Export database excluding specific collections
  echo -e "${YELLOW}📦 Exporting database (excluding ${#EXCLUDE_COLLECTIONS[@]} collection(s))...${NC}"

  docker run --rm \
    --network host \
    -u "$(id -u):$(id -g)" \
    -v "$(pwd)/${EXPORT_DIR}:/backup" \
    mongo:7 \
    sh -c "mongodump \
      --host='${LOCAL_MONGO_HOST}' \
      --port='${LOCAL_MONGO_PORT}' \
      --username='${LOCAL_MONGO_USER}' \
      --password='${LOCAL_MONGO_PASS}' \
      --authenticationDatabase=admin \
      --db='${LOCAL_DB_NAME}' \
      ${EXCLUDE_PARAMS} \
      --out='/backup/${LOCAL_DB_NAME}_${TIMESTAMP}'"
else
  # Export entire database
  echo -e "${YELLOW}📦 Exporting entire database...${NC}"

  docker run --rm \
    --network host \
    -u "$(id -u):$(id -g)" \
    -v "$(pwd)/${EXPORT_DIR}:/backup" \
    mongo:7 \
    mongodump \
    --host="${LOCAL_MONGO_HOST}" \
    --port="${LOCAL_MONGO_PORT}" \
    --username="${LOCAL_MONGO_USER}" \
    --password="${LOCAL_MONGO_PASS}" \
    --authenticationDatabase=admin \
    --db="${LOCAL_DB_NAME}" \
    --out="/backup/${LOCAL_DB_NAME}_${TIMESTAMP}"
fi

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Export completed successfully!${NC}"
  echo ""
  echo -e "${GREEN}Exported to:${NC} ${EXPORT_PATH}"

  # Show export size
  EXPORT_SIZE=$(du -sh "${EXPORT_PATH}" | cut -f1)
  echo -e "${GREEN}Export size:${NC} ${EXPORT_SIZE}"

  # Count collections
  COLLECTION_COUNT=$(find "${EXPORT_PATH}" -name "*.bson" | wc -l)
  echo -e "${GREEN}Collections:${NC} ${COLLECTION_COUNT}"
  echo ""

  # Create a manifest file
  if [ ${#EXCLUDE_COLLECTIONS[@]} -gt 0 ]; then
    cat > "${EXPORT_PATH}/manifest.txt" <<EOF
Database: ${LOCAL_DB_NAME}
Exported: ${TIMESTAMP}
Source: ${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}
Mode: All collections except excluded
Excluded: ${EXCLUDE_COLLECTIONS[*]}
Collection Count: ${COLLECTION_COUNT}
Size: ${EXPORT_SIZE}
EOF
  elif [ ${#COLLECTIONS[@]} -gt 0 ]; then
    cat > "${EXPORT_PATH}/manifest.txt" <<EOF
Database: ${LOCAL_DB_NAME}
Exported: ${TIMESTAMP}
Source: ${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}
Mode: Specific collections
Collections: ${COLLECTIONS[*]}
Collection Count: ${COLLECTION_COUNT}
Size: ${EXPORT_SIZE}
EOF
  else
    cat > "${EXPORT_PATH}/manifest.txt" <<EOF
Database: ${LOCAL_DB_NAME}
Exported: ${TIMESTAMP}
Source: ${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}
Mode: Full database
Collections: ${COLLECTION_COUNT}
Size: ${EXPORT_SIZE}
EOF
  fi

  echo -e "${YELLOW}💡 To import this to production, run:${NC}"
  echo -e "   ./scripts/import-to-production.sh ${LOCAL_DB_NAME}_${TIMESTAMP}"
  echo ""
else
  echo -e "${RED}❌ Export failed!${NC}"
  exit 1
fi
