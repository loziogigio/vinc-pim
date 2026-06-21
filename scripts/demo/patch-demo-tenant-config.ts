/**
 * VINC Demo — patch the demo tenant's registry config so the multi-tenant B2B
 * portal validates (vinc-b2b requires api.pim_api_url AND api.b2b_api_url, else
 * it renders "Errore di Configurazione").
 *
 * The demo has no ERP, so b2b_api_url points at CS (same as pim_api_url) — the
 * portal loads the PIM catalogue + SSO (which resolves via pim_api_url). Override
 * with DEMO_B2B_API_URL if the demo should target a different B2B backend.
 *
 * Usage: npx tsx scripts/demo/patch-demo-tenant-config.ts
 */
import { connectToTenantDb, disconnectDb } from "../lib/db-connect.js";
import { DEMO_TENANT_ID } from "./demo-config.js";

async function main(): Promise<void> {
  await connectToTenantDb(undefined, { dbNameOverride: "vinc-admin", showLogs: false });
  const mongoose = (await import("mongoose")).default;
  const tenants = mongoose.connection.collection("tenants");

  const doc: any = await tenants.findOne({ tenant_id: DEMO_TENANT_ID });
  if (!doc) {
    console.log(`Tenant '${DEMO_TENANT_ID}' not found.`);
    await disconnectDb(false);
    return;
  }

  const pim = doc.api?.pim_api_url || "http://cs.vendereincloud.it";
  const b2bApiUrl = process.env.DEMO_B2B_API_URL || pim;

  const res = await tenants.updateOne(
    { tenant_id: DEMO_TENANT_ID },
    {
      $set: {
        "api.b2b_api_url": b2bApiUrl,
        "database.mongo_db": `vinc-${DEMO_TENANT_ID}`,
        updated_at: new Date(),
      },
    }
  );

  console.log(`✓ demo-it api.b2b_api_url = ${b2bApiUrl}`);
  console.log(`  (pim_api_url = ${pim}; matched ${res.matchedCount}, modified ${res.modifiedCount})`);
  console.log(`  Note: vinc-b2b caches tenant config ~5 min — change may take a few minutes to show.`);
  await disconnectDb(false);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
