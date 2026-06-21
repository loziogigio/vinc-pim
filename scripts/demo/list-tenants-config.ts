/** Diagnostic: compare tenant registry configs (api/database) to find a working B2B reference. */
import { connectToTenantDb, disconnectDb } from "../lib/db-connect.js";

async function main(): Promise<void> {
  await connectToTenantDb(undefined, { dbNameOverride: "vinc-admin", showLogs: false });
  const mongoose = (await import("mongoose")).default;
  const docs: any[] = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const d of docs) {
    const b2bDom = (d.domains || []).map((x: any) => x.hostname).filter((h: string) => /b2b/.test(h));
    console.log(
      `${(d.tenant_id || "?").padEnd(18)} status=${(d.status || "?").padEnd(9)} ` +
        `pim=${(d.api?.pim_api_url || "∅").padEnd(34)} ` +
        `b2b_api=${(d.api?.b2b_api_url || "∅").padEnd(34)} ` +
        `db=${d.database?.mongo_db || (d.database ? "{}" : "∅")} ` +
        `theme=${d.b2b_theme || "∅"} ` +
        `b2bDomains=[${b2bDom.join(",")}]`
    );
  }
  await disconnectDb(false);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
