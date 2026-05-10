#!/usr/bin/env bun
/**
 * B2B Portal Migration Verification — CLI entry point
 *
 * This file is a thin shim that loads the verify script from src/ and
 * runs it. All logic lives in src/scripts/verify-b2b-portal-migration.ts.
 *
 * Usage:
 *   bun run scripts/verify-b2b-portal-migration.ts
 *
 * Env vars:
 *   VINC_MONGO_URL   — required: MongoDB connection string
 */
import "../src/scripts/verify-b2b-portal-migration.ts";
