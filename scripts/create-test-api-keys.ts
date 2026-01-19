import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function createTestKeys() {
  const baseUrl = process.env.VINC_MONGO_URL || "mongodb://root:root@149.81.163.109:27017/?authSource=admin";

  // Use fixed keys for reproducibility in testing (12 hex chars at end)
  const hidrosKeyId = "ak_hidros-it_aabbccddeeff";
  const hidrosSecret = "sk_aabbccddeeff00112233445566778899";
  const hidrosSecretHash = await bcrypt.hash(hidrosSecret, 10);

  const dflKeyId = "ak_dfl-eventi-it_112233445566";
  const dflSecret = "sk_112233445566778899aabbccddeeff00";
  const dflSecretHash = await bcrypt.hash(dflSecret, 10);

  // Create hidros key
  await mongoose.connect(baseUrl, { dbName: "vinc-hidros-it" });
  await mongoose.connection.db?.collection("apikeys").deleteMany({});
  await mongoose.connection.db?.collection("apikeys").insertOne({
    key_id: hidrosKeyId,
    tenant_id: "hidros-it",
    secret_hash: hidrosSecretHash,
    name: "Test API Key",
    permissions: ["*"],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await mongoose.disconnect();

  // Create dfl key
  await mongoose.connect(baseUrl, { dbName: "vinc-dfl-eventi-it" });
  await mongoose.connection.db?.collection("apikeys").deleteMany({});
  await mongoose.connection.db?.collection("apikeys").insertOne({
    key_id: dflKeyId,
    tenant_id: "dfl-eventi-it",
    secret_hash: dflSecretHash,
    name: "Test API Key",
    permissions: ["*"],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await mongoose.disconnect();

  // Save keys to file for reuse
  const keysConfig = {
    hidros: { key_id: hidrosKeyId, secret: hidrosSecret, tenant: "hidros-it" },
    dfl: { key_id: dflKeyId, secret: dflSecret, tenant: "dfl-eventi-it" },
  };
  fs.writeFileSync("scripts/.test-api-keys.json", JSON.stringify(keysConfig, null, 2));

  // Output for testing
  console.log("API Keys Created Successfully!");
  console.log("Keys saved to scripts/.test-api-keys.json");
  console.log("");
  console.log("=== HIDROS ===");
  console.log(`Key ID:  ${hidrosKeyId}`);
  console.log(`Secret:  ${hidrosSecret}`);
  console.log("");
  console.log("=== DFL ===");
  console.log(`Key ID:  ${dflKeyId}`);
  console.log(`Secret:  ${dflSecret}`);
  console.log("");
  console.log("Test with:");
  console.log(`curl -s "http://localhost:3001/api/b2b/customers" \\`);
  console.log(`  -H "x-auth-method: api-key" \\`);
  console.log(`  -H "x-api-key-id: ${hidrosKeyId}" \\`);
  console.log(`  -H "x-api-secret: ${hidrosSecret}" | jq '.customers | length'`);
}

createTestKeys().catch(console.error);
