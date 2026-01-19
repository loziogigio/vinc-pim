import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function checkKeys() {
  const baseUrl = process.env.VINC_MONGO_URL || "mongodb://root:root@149.81.163.109:27017/?authSource=admin";
  console.log("Base URL:", baseUrl.substring(0, 50) + "...");

  // Check hidros
  const hidrosUrl = baseUrl + "&dbName=vinc-hidros-it";
  await mongoose.connect(hidrosUrl, { dbName: "vinc-hidros-it" });
  const hidrosKeys = await mongoose.connection.db?.collection("apikeys").find({}).toArray();
  console.log("\nHidros API keys:", hidrosKeys?.length || 0);
  if (hidrosKeys && hidrosKeys.length > 0) {
    hidrosKeys.forEach(k => console.log("  -", k.key_id, "tenant:", k.tenant_id));
  }
  await mongoose.disconnect();

  // Check dfl
  await mongoose.connect(baseUrl, { dbName: "vinc-dfl-eventi-it" });
  const dflKeys = await mongoose.connection.db?.collection("apikeys").find({}).toArray();
  console.log("\nDFL API keys:", dflKeys?.length || 0);
  if (dflKeys && dflKeys.length > 0) {
    dflKeys.forEach(k => console.log("  -", k.key_id, "tenant:", k.tenant_id));
  }
  await mongoose.disconnect();
}

checkKeys().catch(console.error);
