/**
 * Set windmill_proxy.workspace_name for all tenants.
 *
 * Usage:
 *   node scripts/set-windmill-workspace.cjs time
 */

require("dotenv").config();
const mongoose = require("mongoose");

const WORKSPACE = process.argv[2];
if (!WORKSPACE) {
  console.error("Usage: node scripts/set-windmill-workspace.cjs <workspace-name>");
  console.error("Example: node scripts/set-windmill-workspace.cjs time");
  process.exit(1);
}

async function main() {
  const mongoUri = process.env.VINC_MONGO_URL;
  if (!mongoUri) {
    console.error("VINC_MONGO_URL is required");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(mongoUri, { dbName: "vinc-admin" }).asPromise();
  const tenants = await conn.db.collection("tenants").find({}, { projection: { tenant_id: 1 } }).toArray();
  await conn.close();

  console.log(`Found ${tenants.length} tenants. Setting workspace_name = "${WORKSPACE}"\n`);

  for (const t of tenants) {
    const dbName = `vinc-${t.tenant_id}`;
    const tenantConn = await mongoose.createConnection(mongoUri, { dbName }).asPromise();
    const result = await tenantConn.db.collection("b2bhomesettings").updateOne(
      {},
      { $set: { "windmill_proxy.workspace_name": WORKSPACE } },
    );
    const status = result.matchedCount > 0 ? `updated (matched: ${result.matchedCount})` : "no settings doc";
    console.log(`  ${t.tenant_id}: ${status}`);
    await tenantConn.close();
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
