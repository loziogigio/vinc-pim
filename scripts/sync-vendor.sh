#!/usr/bin/env bash
# Vendor shared packages from vendereincloud-app/packages/ into vendor/ (dist-only).
set -euo pipefail
cd "$(dirname "$0")/.."
# CS repo root sits TWO levels under vendereincloud-app (vendereincloud-it/vinc-commerce-suite),
# vs vinc-www/site which is three — so the path differs from vinc-www's script.
PKGS_DIR="$(cd ../../packages && pwd)"
PACKAGES=(vinc-analytics vinc-notifications vinc-cms-admin)
for p in "${PACKAGES[@]}"; do
  echo "── $p"
  (cd "$PKGS_DIR/$p" && pnpm install --silent && rm -rf dist && pnpm build)
  rm -rf "vendor/$p"; mkdir -p "vendor/$p"
  cp -r "$PKGS_DIR/$p/dist" "vendor/$p/dist"
  cp "$PKGS_DIR/$p/package.json" "vendor/$p/package.json"
  [ -f "$PKGS_DIR/$p/README.md" ] && cp "$PKGS_DIR/$p/README.md" "vendor/$p/README.md" || true
done
pnpm install
echo "vendor/ synced"
