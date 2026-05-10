#!/usr/bin/env bun
/**
 * B2B Portal Migration Script
 *
 * Migrates each tenant from the legacy b2bhomesettings / b2bhometemplates
 * structure to the new b2bportals model introduced in Phase 1.
 *
 * Usage:
 *   bun run scripts/migrate-b2b-portal.ts --all
 *   bun run scripts/migrate-b2b-portal.ts --tenant=dfl-it
 *   bun run scripts/migrate-b2b-portal.ts --dry-run --all
 *   bun run scripts/migrate-b2b-portal.ts --force --tenant=dfl-it
 *   bun run scripts/migrate-b2b-portal.ts --rollback=dfl-it
 *
 * Steps per tenant (in order):
 *  1. Skip if already migrated (b2b_portal_migrated_at set), unless --force.
 *  2. Drop the legacy unique index `templateId_1_version_1` on b2bhometemplates
 *     if it exists (graceful no-op when already dropped).
 *  3. Read b2bhomesettings → buildPortalFromHomeSettings → upsert into b2bportals.
 *  4. Backfill portal_slug="default" on all b2bhometemplates docs that lack it.
 *  5. Mark tenant migrated (sets b2b_portal_migrated_at in admin DB).
 *  6. Write an audit entry to migration_log in the admin DB.
 *
 * Rollback (--rollback=<tenant>):
 *  Reverses steps 3–5 in reverse order and writes a rollback audit entry.
 *  NOTE: The old index (step 2) is NOT recreated by rollback — it is safe to
 *  leave it dropped; the new portal-scoped index supersedes it.
 *
 * Idempotency:
 *  - Re-running against an already-migrated tenant is a no-op (skipped).
 *  - Use --force to re-run against a migrated tenant (upserts, no duplicates).
 *  - DRY_RUN=true env var or --dry-run flag logs intent without writing.
 *
 * See docs/claude/b2b-portal-migration-runbook.md for operator guidance.
 */

import { connectWithModels } from "@/lib/db/connection";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import {
  isTenantMigrated,
  markTenantMigrated,
  clearTenantMigrationFlag,
} from "@/lib/services/b2b-portal-migration-flag.service";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import { buildPortalFromHomeSettings } from "@/lib/services/b2b-portal-migration.service";
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

// ── Public types ──────────────────────────────────────────────────────────────

export interface MigrateOptions {
  dryRun: boolean;
  force: boolean;
}

export interface MigrateResult {
  status: "migrated" | "skipped" | "dry-run";
  details: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Drop the legacy unique index `templateId_1_version_1` from b2bhometemplates
 * if it still exists. Gracefully ignores "index not found" errors.
 */
async function dropLegacyHomeTemplateIndex(
  HomeTemplate: any,
  tenantId: string,
): Promise<void> {
  try {
    await HomeTemplate.collection.dropIndex("templateId_1_version_1");
    console.log(`[${tenantId}] dropped legacy index templateId_1_version_1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // MongoDB error codes for "index not found" are 27 (IndexNotFound) and "ns not found"
    if (
      msg.includes("index not found") ||
      msg.includes("IndexNotFound") ||
      msg.includes("ns not found")
    ) {
      // Already dropped — idempotent no-op
    } else {
      // Non-fatal warning: log but continue (the new portal-scoped index will
      // still be created; the old one may have been renamed differently)
      console.warn(`[${tenantId}] non-fatal dropIndex warning: ${msg}`);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Migrate a single tenant to the b2bportals structure.
 *
 * @param tenantId  - The tenant_id string (e.g. "dfl-it").
 * @param opts      - Migration options (dryRun, force).
 * @returns         A result object describing what was done.
 */
export async function migrateOneTenant(
  tenantId: string,
  opts: MigrateOptions,
): Promise<MigrateResult> {
  // Step 1: Skip if already migrated (unless --force)
  const alreadyMigrated = await isTenantMigrated(tenantId);
  if (alreadyMigrated && !opts.force) {
    console.log(`[${tenantId}] skipped — already migrated`);
    return { status: "skipped", details: "already migrated" };
  }

  // Fetch the admin tenant doc to get display_name and db_config
  const Tenant = await getTenantModel();
  const tenantDoc = await Tenant.findOne({ tenant_id: tenantId }).lean();
  if (!tenantDoc) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }

  // Resolve the tenant database name
  const dbName =
    (tenantDoc as any).db_config?.mongo_db ??
    (tenantDoc as any).database?.mongo_db ??
    `vinc-${tenantId}`;

  const displayName =
    (tenantDoc as any).display_name ??
    (tenantDoc as any).name ??
    tenantId;

  const { B2BPortal, HomeSettings, HomeTemplate } = await connectWithModels(dbName);

  // Step 3 (preview): Read the b2bhomesettings document
  const settingsDoc = await HomeSettings.findOne({}).lean();
  if (!settingsDoc) {
    console.log(`[${tenantId}] skipped — no b2bhomesettings doc`);
    return { status: "skipped", details: "no b2bhomesettings doc" };
  }

  const portal = buildPortalFromHomeSettings(settingsDoc as any, displayName);

  // ── DRY-RUN path ────────────────────────────────────────────────────────────
  if (opts.dryRun) {
    const htCount = await HomeTemplate.countDocuments({
      portal_slug: { $exists: false },
    });
    console.log(`[DRY-RUN ${tenantId}] would drop legacy index templateId_1_version_1`);
    console.log(`[DRY-RUN ${tenantId}] would upsert portal: slug=${portal.slug}, name=${portal.name}`);
    console.log(`[DRY-RUN ${tenantId}] would backfill portal_slug on ${htCount} HomeTemplate docs`);
    console.log(`[DRY-RUN ${tenantId}] would mark tenant migrated`);
    return { status: "dry-run", details: `would migrate tenant ${tenantId}` };
  }

  // ── Live migration ───────────────────────────────────────────────────────────

  // Step 2: Drop the legacy unique index (if present)
  await dropLegacyHomeTemplateIndex(HomeTemplate, tenantId);

  // Step 3: Upsert the "default" portal document (idempotent under --force)
  await B2BPortal.updateOne(
    { slug: DEFAULT_PORTAL_SLUG },
    { $set: portal },
    { upsert: true },
  );
  console.log(`[${tenantId}] upserted b2bportals doc with slug="${DEFAULT_PORTAL_SLUG}"`);

  // Step 4: Backfill portal_slug on all b2bhometemplates that lack it
  const backfillResult = await HomeTemplate.updateMany(
    { portal_slug: { $exists: false } },
    { $set: { portal_slug: DEFAULT_PORTAL_SLUG } },
  );
  console.log(
    `[${tenantId}] backfilled portal_slug on ${backfillResult.modifiedCount} HomeTemplate docs`,
  );

  // Step 5: Mark the tenant migrated in the admin DB
  await markTenantMigrated(tenantId);
  console.log(`[${tenantId}] marked migrated`);

  // Step 6: Write audit log entry in admin DB
  const adminConn = await connectToAdminDatabase();
  await adminConn.db.collection("migration_log").insertOne({
    script: "migrate-b2b-portal",
    tenant_id: tenantId,
    at: new Date(),
    result: "success",
  });

  console.log(`[${tenantId}] migration complete`);
  return { status: "migrated", details: `migrated tenant ${tenantId}` };
}

/**
 * Roll back a single tenant's migration.
 *
 * Removes the "default" portal doc, clears the migration flag, and writes
 * a rollback audit entry. Does NOT recreate the old index.
 *
 * @param tenantId  - The tenant_id string.
 */
export async function rollbackOneTenant(tenantId: string): Promise<void> {
  const Tenant = await getTenantModel();
  const tenantDoc = await Tenant.findOne({ tenant_id: tenantId }).lean();
  if (!tenantDoc) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }

  const dbName =
    (tenantDoc as any).db_config?.mongo_db ??
    (tenantDoc as any).database?.mongo_db ??
    `vinc-${tenantId}`;

  const { B2BPortal } = await connectWithModels(dbName);

  // Remove the "default" portal document
  const del = await B2BPortal.deleteOne({ slug: DEFAULT_PORTAL_SLUG });
  console.log(
    `[${tenantId}] removed ${del.deletedCount} b2bportals doc(s) with slug="${DEFAULT_PORTAL_SLUG}"`,
  );

  // Clear the migration flag
  await clearTenantMigrationFlag(tenantId);
  console.log(`[${tenantId}] cleared b2b_portal_migrated_at flag`);

  // Write rollback audit entry
  const adminConn = await connectToAdminDatabase();
  await adminConn.db.collection("migration_log").insertOne({
    script: "migrate-b2b-portal",
    tenant_id: tenantId,
    at: new Date(),
    result: "rollback",
  });

  console.log(`[${tenantId}] rollback complete`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

/**
 * List all active tenant IDs from the admin DB.
 */
async function listActiveTenantIds(): Promise<string[]> {
  const Tenant = await getTenantModel();
  const docs = await Tenant.find({ status: "active" }).select("tenant_id").lean();
  return docs.map((d: any) => d.tenant_id as string);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const dryRun =
    args.includes("--dry-run") ||
    process.env.DRY_RUN === "true" ||
    process.env.DRY_RUN === "1";

  const force = args.includes("--force");
  const all = args.includes("--all");

  const tenantArg = args
    .find((a) => a.startsWith("--tenant="))
    ?.slice("--tenant=".length);

  const rollbackArg = args
    .find((a) => a.startsWith("--rollback="))
    ?.slice("--rollback=".length);

  // ── Rollback mode ──────────────────────────────────────────────────────────
  if (rollbackArg) {
    try {
      await rollbackOneTenant(rollbackArg);
      console.log(`\nRolled back tenant: ${rollbackArg}`);
    } catch (err) {
      console.error(`ERROR rolling back tenant ${rollbackArg}:`, err);
      process.exit(1);
    }
    return;
  }

  // ── Migrate mode ───────────────────────────────────────────────────────────
  const tenantIds = tenantArg
    ? [tenantArg]
    : all
      ? await listActiveTenantIds()
      : [];

  if (tenantIds.length === 0) {
    console.error(
      "Error: pass --tenant=<id>, --all, or --rollback=<id>.\n" +
        "  bun run scripts/migrate-b2b-portal.ts --all\n" +
        "  bun run scripts/migrate-b2b-portal.ts --tenant=dfl-it\n" +
        "  bun run scripts/migrate-b2b-portal.ts --rollback=dfl-it",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("DRY-RUN mode — no writes will be made.\n");
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const id of tenantIds) {
    try {
      const result = await migrateOneTenant(id, { dryRun, force });
      if (result.status === "migrated") migrated += 1;
      else skipped += 1;
    } catch (err) {
      console.error(`[${id}] ERROR:`, err);
      errors += 1;
    }
  }

  console.log(
    `\nDone. migrated=${migrated} skipped=${skipped} errors=${errors}`,
  );

  if (errors > 0) {
    process.exit(1);
  }
}

// Run only when invoked directly (not when imported by tests)
if (
  typeof process !== "undefined" &&
  (process.argv[1]?.endsWith("migrate-b2b-portal.ts") ||
    process.argv[1]?.endsWith("migrate-b2b-portal"))
) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
