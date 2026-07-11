/** Diagnostic: print the demo tenant's registry config (vinc-admin.tenants), secrets masked. */
import { connectToTenantDb, disconnectDb } from "../lib/db-connect.js";
import { DEMO_TENANT_ID } from "./demo-config.js";

async function main(): Promise<void> {
  await connectToTenantDb(undefined, { dbNameOverride: "vinc-admin", showLogs: false });
  const mongoose = (await import("mongoose")).default;
  const doc: any = await mongoose.connection.collection("tenants").findOne({ tenant_id: DEMO_TENANT_ID });
  if (!doc) {
    console.log(`Tenant '${DEMO_TENANT_ID}' NOT FOUND in vinc-admin.tenants`);
    await disconnectDb(false);
    return;
  }
  const present = (v: any) => (v === undefined || v === null || v === "" ? "∅ MISSING" : "✓ set");
  console.log(JSON.stringify({
    tenant_id: doc.tenant_id,
    name: doc.name,
    status: doc.status,
    project_code: doc.project_code,
    mongo_db: doc.mongo_db,
    solr_core: doc.solr_core,
    domains: doc.domains,
    require_login: doc.require_login,
    b2b_theme: doc.b2b_theme,
    builder_url: doc.builder_url,
    home_settings_customer_id: doc.home_settings_customer_id,
    features: doc.features,
    "api?": present(doc.api),
    api: doc.api && {
      pim_api_url: doc.api.pim_api_url, b2b_api_url: doc.api.b2b_api_url, erp_url: doc.api.erp_url,
      api_key_id: doc.api.api_key_id, "api_secret?": present(doc.api.api_secret),
    },
    "database?": present(doc.database),
    database: doc.database && { "mongo_url?": present(doc.database.mongo_url), mongo_db: doc.database.mongo_db },
    topLevelKeys: Object.keys(doc),
  }, null, 2));
  await disconnectDb(false);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
