#!/usr/bin/env bash
# Demo reset wrapper for cron. Arg: "soft" (default) or "hard".
set -euo pipefail
MODE="${1:-soft}"
# APP_DIR MUST be confirmed on vinc-2 (see demo-reset.crontab Step 3) and passed
# via the cron env (VINC_CS_DIR), not silently hardcoded.
# Falls back only if VINC_CS_DIR is unset.
APP_DIR="${VINC_CS_DIR:-/home/it/vinc-commerce-suite}"
LOG_DIR="${VINC_DEMO_LOG_DIR:-/var/log/vinc-demo}"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
cd "$APP_DIR"
ARGS=""
[ "$MODE" = "hard" ] && ARGS="--hard"
echo "[$(date -Is)] demo reset ($MODE) starting (APP_DIR=$APP_DIR)" >>"$LOG_DIR/reset.log"
# .env in $APP_DIR supplies VINC_MONGO_URL, SOLR_*, DEMO_*_PASSWORD.
npx tsx scripts/demo/reset-demo-tenant.ts $ARGS >>"$LOG_DIR/reset-$TS.log" 2>&1
echo "[$(date -Is)] demo reset ($MODE) done" >>"$LOG_DIR/reset.log"
