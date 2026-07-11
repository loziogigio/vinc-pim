/**
 * VINC Demo — force the vinc-b2b instances to drop their cached tenant config
 * for the demo tenant (the same notification the CS admin flow fires on update).
 * Use after patch-demo-tenant-config.ts so the fix shows immediately.
 *
 * Usage: npx tsx scripts/demo/clear-b2b-cache.ts
 */
import "dotenv/config";
import { DEMO_TENANT_ID } from "./demo-config.js";

async function main(): Promise<void> {
  const { notifyTenantCacheClear } = await import("../../src/lib/services/cache-clear.service.js");
  console.log(`Notifying b2b instances to clear cache for '${DEMO_TENANT_ID}'…`);
  await notifyTenantCacheClear({ tenantId: DEMO_TENANT_ID });
  console.log("Done.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
