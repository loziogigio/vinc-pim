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
 *   npx tsx scripts/demo/reset-demo-tenant.ts --dry-run        # show soft plan, no writes
 *   npx tsx scripts/demo/reset-demo-tenant.ts                  # perform the soft reset
 *   npx tsx scripts/demo/reset-demo-tenant.ts --hard --dry-run # show hard plan, no writes
 *   npx tsx scripts/demo/reset-demo-tenant.ts --hard           # perform the hard reset
 *
 * Soft reset (default): wipes orders, re-seeds catalog/accounts/channels/storefront
 * + order-history, then reindexes Solr. Does NOT touch branding/page-builder edits.
 *
 * Hard reset (--hard): additionally drops the branding/page collections
 * (b2bhometemplates, b2bhomesettings, categories), then runs the full soft reset
 * (which re-seeds catalog/customers/categories/order-history AND re-publishes the
 * home template via ensureHomeTemplate), then re-applies branding via
 * configure-demo-branding.ts (Task 11), then reindexes Solr.
 * Use weekly (cron) or after branding/page-builder changes need to be reset.
 */

import { DEMO_TENANT_ID, DEMO_DB_NAME, requireDemoPasswords } from "./demo-config.js";
import { wipeOrders, seedDemoData, log } from "./seed-helpers.js";

const DRY_RUN = process.argv.includes("--dry-run");
const HARD = process.argv.includes("--hard");

// b2bhomesettings holds branding + headerConfig + footerHtml; b2bhometemplates
// holds the published home page; categories are re-seeded by seedDemoData.
const HARD_COLLECTIONS = ["b2bhometemplates", "b2bhomesettings", "categories"];

async function dropHardCollections(): Promise<void> {
  const mongoose = (await import("mongoose")).default;
  for (const name of HARD_COLLECTIONS) {
    try { await mongoose.connection.collection(name).drop(); console.log(`  ✓ dropped ${name}`); }
    catch (e: any) { if (e?.codeName === "NamespaceNotFound") console.log(`  • ${name} absent`); else throw e; }
  }
}

async function main(): Promise<void> {
  const pwds = requireDemoPasswords();

  if (DRY_RUN) {
    console.log("DRY RUN — no database writes\n");
    console.log(`Would reset tenant: ${DEMO_TENANT_ID} (db ${DEMO_DB_NAME})`);
    if (HARD) {
      console.log("Mode: HARD (drops branding/page collections then re-seeds + re-brands)\n");
      console.log("Plan:");
      console.log(`  1. drop collections: ${HARD_COLLECTIONS.join(", ")}`);
      console.log("  2. wipe all carts/orders");
      console.log("  3. re-seed fictional catalog (undo product edits)");
      console.log("  4. restore channels, customers, portal users, storefront");
      console.log("  5. install order-history defs + records");
      console.log("  6. re-publish home template (ensureHomeTemplate, Task 12)");
      console.log("  7. re-apply branding config (applyDemoBranding, Task 11)");
      console.log("  8. reindex Solr");
    } else {
      console.log("Mode: soft (catalog/accounts/order-history only; branding/pages untouched)\n");
      console.log("Plan:");
      console.log("  1. wipe all carts/orders");
      console.log("  2. re-seed fictional catalog (undo product edits)");
      console.log("  3. restore channels, customers, portal users, storefront");
      console.log("  4. install order-history defs + records");
      console.log("  5. reindex Solr");
    }
    return;
  }

  const { connectToTenantDb, disconnectDb } = await import("../lib/db-connect.js");
  const mode = HARD ? "HARD" : "soft";
  console.log(`\n♻️  Resetting demo tenant '${DEMO_TENANT_ID}' (${mode})...`);

  await connectToTenantDb(DEMO_TENANT_ID);
  try {
    if (HARD) {
      console.log("\n🧨 HARD reset — dropping branding/page collections");
      await dropHardCollections();
    }
    await wipeOrders();
    await seedDemoData(pwds, new Date()); // re-seeds catalog/customers/categories/order-history + re-publishes home template (ensureHomeTemplate)
    if (HARD) {
      console.log("\n🎨 Re-applying branding config");
      const { applyDemoBranding } = await import("./configure-demo-branding.js"); // Task 11
      await applyDemoBranding();
    }
    console.log("\n🔍 Reindexing Solr…");
    const { reindexDemoSolr } = await import("./reindex-demo-solr.js");
    await reindexDemoSolr();
  } finally {
    await disconnectDb();
  }

  log("\n✅ Demo reset complete.");
  log("Solr reindex completed in-process.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Reset failed:", err);
    process.exit(1);
  });
