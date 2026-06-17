/**
 * VINC Demo — reset the shared `vinc-demo` tenant to pristine state (task A6)
 *
 * "Clears after a while": wipes visitor-generated carts/orders and restores the
 * fictional catalog + demo accounts + channels + storefront. This is what keeps
 * the shared, full-admin demo safe — any changes a visitor makes are undone.
 *
 * Reuses the idempotent helpers from seed-helpers.ts (same logic as provisioning).
 *
 * Usage:
 *   npx tsx scripts/demo/reset-demo-tenant.ts --dry-run   # show plan, no writes
 *   npx tsx scripts/demo/reset-demo-tenant.ts             # perform the reset
 *
 * After a reset, re-index Solr so the restored catalog is searchable:
 *   npx tsx scripts/bulk-sync-to-solr.ts --tenant demo
 * (Phase B schedules this script + the Solr sync together, e.g. nightly.)
 *
 * KNOWN LIMITATION: this restores catalog/accounts/channels/storefront and wipes
 * orders, but does NOT reset page-builder / header / footer edits made by the
 * demo admin. A future `--hard` mode (drop tenant + re-provision) would cover those.
 */

import { DEMO_TENANT_ID, DEMO_DB_NAME, requireDemoPasswords } from "./demo-config.js";
import { wipeOrders, seedDemoData, log } from "./seed-helpers.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const pwds = requireDemoPasswords();

  if (DRY_RUN) {
    console.log("DRY RUN — no database writes\n");
    console.log(`Would reset tenant: ${DEMO_TENANT_ID} (db ${DEMO_DB_NAME})`);
    console.log("Plan:");
    console.log("  1. wipe all carts/orders");
    console.log("  2. re-seed fictional catalog (undo product edits)");
    console.log("  3. restore channels, customers, portal users, storefront");
    console.log("  4. install order-history defs + records");
    console.log("  5. reindex Solr");
    return;
  }

  const { connectToTenantDb, disconnectDb } = await import("../lib/db-connect.js");
  console.log(`\n♻️  Resetting demo tenant '${DEMO_TENANT_ID}'...`);

  await connectToTenantDb(DEMO_TENANT_ID);
  try {
    await wipeOrders();
    await seedDemoData(pwds, new Date());
    console.log("\n🔍 Reindexing Solr…");
    const { reindexDemoSolr } = await import("./reindex-demo-solr.js");
    await reindexDemoSolr();
  } finally {
    await disconnectDb();
  }

  log("\n✅ Demo reset complete.");
  log(`Next: re-index Solr →  npx tsx scripts/bulk-sync-to-solr.ts --tenant ${DEMO_TENANT_ID}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Reset failed:", err);
    process.exit(1);
  });
