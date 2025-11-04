#!/bin/bash

#########################################
# List MongoDB Exports
#########################################

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

EXPORT_DIR="./mongodb-exports"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Available MongoDB Exports${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -d "$EXPORT_DIR" ]; then
  echo -e "${YELLOW}No exports directory found.${NC}"
  exit 0
fi

# List exports with details
for export_folder in $(ls -1 "$EXPORT_DIR" | sort -r); do
  export_path="${EXPORT_DIR}/${export_folder}"

  if [ -d "$export_path" ]; then
    # Check if it's a backup
    if [[ $export_folder == BACKUP_* ]]; then
      echo -e "${YELLOW}📦 ${export_folder}${NC} (BACKUP)"
    else
      echo -e "${GREEN}📁 ${export_folder}${NC}"
    fi

    # Show manifest if exists
    if [ -f "${export_path}/manifest.txt" ]; then
      cat "${export_path}/manifest.txt" | sed 's/^/   /' | head -4
    else
      # Show size and collection count
      size=$(du -sh "$export_path" 2>/dev/null | cut -f1)
      collections=$(find "$export_path" -name "*.bson" 2>/dev/null | wc -l)
      echo -e "   Size: ${size}"
      echo -e "   Collections: ${collections}"
    fi
    echo ""
  fi
done

echo -e "${YELLOW}💡 To export from local:${NC}"
echo -e "   ./scripts/export-local-db.sh [database-name]"
echo ""
echo -e "${YELLOW}💡 To import to production:${NC}"
echo -e "   ./scripts/import-to-production.sh <export-folder>"
echo ""
