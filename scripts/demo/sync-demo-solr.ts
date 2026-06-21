/**
 * VINC Demo — index the demo tenant's catalog into Solr (Phase B helper).
 *
 * The generic scripts/bulk-sync-to-solr.ts binds the app connection POOL while
 * PIMProductModel uses the DEFAULT mongoose connection — so its find() buffers.
 * This variant uses connectToTenantDb (same as provision-demo-tenant.ts): it
 * loads .env AND binds the default connection, so the model resolves.
 *
 * Usage: npx tsx scripts/demo/sync-demo-solr.ts
 * Run after provisioning/resetting the demo tenant.
 */

import { connectToTenantDb, disconnectDb } from "../lib/db-connect.js";
import { DEMO_TENANT_ID } from "./demo-config.js";

async function main(): Promise<void> {
  await connectToTenantDb(DEMO_TENANT_ID);
  const { reindexDemoSolr } = await import("./reindex-demo-solr.js");
  await reindexDemoSolr();
  await disconnectDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Solr sync failed:", err);
    process.exit(1);
  });
