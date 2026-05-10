#!/usr/bin/env bun
/**
 * B2B Portal Migration Verification
 *
 * Exits non-zero if any active tenant is unmigrated.
 * Used as a CI gate before merging the Phase 2 PR.
 *
 * Usage:
 *   bun run scripts/verify-b2b-portal-migration.ts
 *
 * Exit codes:
 *   0 — all active tenants have been migrated
 *   1 — one or more active tenants are not yet migrated
 */

import { listUnmigratedTenants } from "@/lib/services/b2b-portal-migration-flag.service";

export interface VerifyResult {
  ok: boolean;
  unmigrated: string[];
}

export async function checkAllTenantsMigrated(): Promise<VerifyResult> {
  const unmigrated = await listUnmigratedTenants();
  return { ok: unmigrated.length === 0, unmigrated };
}

async function main() {
  const { ok, unmigrated } = await checkAllTenantsMigrated();
  if (ok) {
    console.log("All active tenants migrated.");
    process.exit(0);
  } else {
    console.error(`Unmigrated tenants (${unmigrated.length}):`);
    for (const id of unmigrated) console.error(`  - ${id}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
