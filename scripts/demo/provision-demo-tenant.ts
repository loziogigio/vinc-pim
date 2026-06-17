/**
 * VINC Demo — provision the shared `vinc-demo` tenant (Phase A / task A2)
 *
 * Idempotent: safe to re-run. Creates the tenant if missing, then ensures the
 * sales channels, demo customers, portal users, B2C storefront and the
 * fictional catalog (shared helpers in seed-helpers.ts; reused by the reset job).
 *
 * Usage:
 *   # validate config + build catalog WITHOUT touching any database:
 *   npx tsx scripts/demo/provision-demo-tenant.ts --dry-run
 *
 *   # full provisioning (requires VINC_MONGO_URL + SOLR_* + DEMO_*_PASSWORD):
 *   npx tsx scripts/demo/provision-demo-tenant.ts
 *
 * Solr indexing is a SEPARATE step (Solr may be unreachable locally):
 *   npx tsx scripts/bulk-sync-to-solr.ts --tenant demo
 *
 * NOTE: this only WRITES data. Standing up the 3 demo surfaces on the swarm
 * (images, Traefik routes, DNS) is Phase B.
 */

import {
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  DEMO_PROJECT_CODE,
  DEMO_DOMAINS,
  DEMO_ADMIN_EMAIL,
  DEMO_SALES_CHANNELS,
  DEMO_CUSTOMERS,
  DEMO_PORTAL_USERS,
  DEMO_STOREFRONT,
  DEMO_DB_NAME,
  requireDemoPasswords,
  getDemoAccess,
  type DemoPasswords,
} from "./demo-config.js";
import { buildDemoCatalog, DEMO_CATALOG_SIZE } from "./demo-catalog.js";
import { buildOrderHistoryRecords } from "./demo-order-history.js";
import { log, seedDemoData } from "./seed-helpers.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function ensureTenant(adminPassword: string): Promise<void> {
  console.log("\n▸ Tenant");
  const { createTenant } = await import("../../src/lib/services/admin-tenant.service.js");
  try {
    const result = await createTenant({
      tenant_id: DEMO_TENANT_ID,
      name: DEMO_TENANT_NAME,
      admin_email: DEMO_ADMIN_EMAIL,
      admin_password: adminPassword,
      admin_name: "Demo Admin",
      created_by: "demo-provision",
      project_code: DEMO_PROJECT_CODE,
      // Hostnames that resolve to the demo tenant on the existing multi-tenant
      // apps: the B2B portal (demo-b2b) and the CS back-office panel (demo-ufficio).
      // The B2C storefront host (demo-b2c) lives on the storefront record instead.
      domains: [
        { hostname: DEMO_DOMAINS.b2b, protocol: "https", is_primary: true, is_active: true },
        { hostname: DEMO_DOMAINS.ufficio, protocol: "https", is_primary: false, is_active: true },
      ],
    } as any);
    log(`  ✓ created tenant '${DEMO_TENANT_ID}' (db: ${result.tenant.mongo_db}, solr: ${result.tenant.solr_core})`);
    log(`  ✓ admin B2BUser: ${DEMO_ADMIN_EMAIL}`);
  } catch (err: any) {
    if (/already exists/i.test(err?.message ?? "")) {
      log(`  • tenant '${DEMO_TENANT_ID}' already exists — re-seeding in place`);
    } else {
      throw err;
    }
  }
}

function printSummary(pwds: DemoPasswords): void {
  console.log(`\n${"=".repeat(64)}`);
  console.log(`VINC DEMO — access summary`);
  console.log(`${"=".repeat(64)}`);
  console.log(`Hub (guideline page): https://${DEMO_DOMAINS.hub}`);
  for (const a of getDemoAccess(pwds)) {
    console.log(`\n${a.surface}`);
    console.log(`  url:      ${a.url}`);
    console.log(`  login:    ${a.login}`);
    console.log(`  password: ${a.password}`);
    if (a.note) console.log(`  note:     ${a.note}`);
  }
  console.log(`\n${"=".repeat(64)}`);
  console.log(`Next: index to Solr →  npx tsx scripts/bulk-sync-to-solr.ts --tenant ${DEMO_TENANT_ID}`);
  console.log(`${"=".repeat(64)}\n`);
}

async function main(): Promise<void> {
  const pwds = requireDemoPasswords();

  if (DRY_RUN) {
    console.log("DRY RUN — no database writes\n");
    const products = buildDemoCatalog(new Date("2026-01-01T00:00:00Z"));
    console.log(`Would provision tenant: ${DEMO_TENANT_ID} (db ${DEMO_DB_NAME})`);
    console.log(`Sales channels: ${DEMO_SALES_CHANNELS.map((c) => c.code).join(", ")}`);
    console.log(`Customers: ${DEMO_CUSTOMERS.length}`);
    console.log(`Portal users: ${DEMO_PORTAL_USERS.map((u) => `${u.username}/${u.channel}`).join(", ")}`);
    console.log(`Catalog products: ${products.length} (const ${DEMO_CATALOG_SIZE})`);
    console.log(`Order-history records: ${buildOrderHistoryRecords(new Date("2026-06-01")).length}`);
    console.log(`Storefront: ${DEMO_STOREFRONT.slug} → ${DEMO_DOMAINS.b2c}`);
    printSummary(pwds);
    return;
  }

  const { connectToTenantDb, disconnectDb } = await import("../lib/db-connect.js");

  await ensureTenant(pwds.admin);
  // createTenant manages its own connections; now bind the default connection
  // to the tenant DB for the model-based seeding below.
  await connectToTenantDb(DEMO_TENANT_ID);
  try {
    await seedDemoData(pwds, new Date());
  } finally {
    await disconnectDb();
  }

  printSummary(pwds);
  log("✅ Demo tenant provisioned. Run the Solr sync next (see above).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Provisioning failed:", err);
    process.exit(1);
  });
