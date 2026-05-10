#!/usr/bin/env bun
/**
 * B2B Portal Migration — CLI entry point
 *
 * This file is a thin shim that loads the migration script from src/ and
 * runs it. All logic lives in src/scripts/migrate-b2b-portal.ts.
 *
 * Usage:
 *   bun run scripts/migrate-b2b-portal.ts --all
 *   bun run scripts/migrate-b2b-portal.ts --tenant=dfl-it
 *   bun run scripts/migrate-b2b-portal.ts --dry-run --all
 *   bun run scripts/migrate-b2b-portal.ts --force --tenant=dfl-it
 *   bun run scripts/migrate-b2b-portal.ts --rollback=dfl-it
 *
 * Env vars:
 *   VINC_MONGO_URL   — required: MongoDB connection string
 *   DRY_RUN=true     — equivalent to --dry-run flag
 */
import "../src/scripts/migrate-b2b-portal.ts";
