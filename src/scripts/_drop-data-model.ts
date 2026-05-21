/**
 * One-off: drop a data model definition + its dynamic collection.
 *
 * Usage: pnpm tsx src/scripts/_drop-data-model.ts --tenant hidros-it --slug historical_order
 */

import "dotenv/config";
import { connectWithModels, closeAllConnections } from "@/lib/db/connection";
import { getPooledConnection } from "@/lib/db/connection-pool";

async function main() {
  const argv = process.argv.slice(2);
  let tenant: string | undefined;
  let slug: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tenant") tenant = argv[++i];
    if (argv[i] === "--slug") slug = argv[++i];
  }
  if (!tenant || !slug) {
    console.error("Usage: --tenant <id> --slug <model_slug>");
    process.exit(1);
  }
  const tenantDb = `vinc-${tenant}`;

  const { DataModelDefinition } = await connectWithModels(tenantDb);
  const existing = await DataModelDefinition.findOne({ slug });
  if (!existing) {
    console.log(`No definition with slug "${slug}" in ${tenantDb}.`);
  } else {
    await DataModelDefinition.deleteOne({ _id: existing._id });
    console.log(`✅ Deleted definition ${existing._id}`);
  }

  const conn = await getPooledConnection(tenantDb);
  try {
    await conn.db.dropCollection(`dyn_${slug}`);
    console.log(`✅ Dropped collection dyn_${slug}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ns not found/i.test(msg)) {
      console.log(`Collection dyn_${slug} did not exist.`);
    } else {
      throw e;
    }
  }
  if (conn.models[`DynRecord_${slug}`]) {
    conn.deleteModel(`DynRecord_${slug}`);
  }

  await closeAllConnections();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
  });
