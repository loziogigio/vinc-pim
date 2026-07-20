/**
 * Recreate b2cstorefronts.channel_1 as sparse-unique. Only needed on tenant DBs
 * that will hold storefronts WITHOUT a channel (Phase 1: only vinc-office).
 * Usage: npx tsx scripts/migrations/2026-07-b2c-channel-sparse-index.ts vinc-office
 */
import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const dbName = process.argv[2];
  if (!dbName) throw new Error("usage: … <tenantDb>");
  if (!process.env.VINC_MONGO_URL) throw new Error("VINC_MONGO_URL is not set (define it in .env or the environment)");
  const conn = await mongoose.createConnection(process.env.VINC_MONGO_URL!, { dbName }).asPromise();
  const col = conn.db!.collection("b2cstorefronts");
  const indexes = await col.indexes();
  const existing = indexes.find((i) => i.name === "channel_1");
  if (existing && !existing.sparse) {
    await col.dropIndex("channel_1");
    console.log("dropped non-sparse channel_1");
  }
  await col.createIndex({ channel: 1 }, { unique: true, sparse: true, name: "channel_1" });
  console.log("channel_1 is sparse-unique on", dbName);
  await conn.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
