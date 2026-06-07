/**
 * Clear all brands from MongoDB - Tenant-aware version
 *
 * Deletes every document in the tenant's `brands` collection. Products keep
 * their embedded (denormalized) brand copy; Solr is not touched.
 *
 * Usage:
 *   npx tsx scripts/clear-brands.ts <tenant-id>
 *   npx tsx scripts/clear-brands.ts dfl-eventi-it
 *   npx tsx scripts/clear-brands.ts hidros-it
 *
 * WARNING: This will delete ALL brand documents for the given tenant!
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (independent of current working directory)
dotenv.config({ path: path.join(__dirname, "../.env") });

import mongoose from "mongoose";
import { BrandModel } from "../src/lib/db/models/brand";

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error("❌ Error: Tenant ID is required");
  console.error("");
  console.error("Usage: npx tsx scripts/clear-brands.ts <tenant-id>");
  console.error("");
  console.error("Examples:");
  console.error("  npx tsx scripts/clear-brands.ts dfl-eventi-it");
  console.error("  npx tsx scripts/clear-brands.ts hidros-it");
  process.exit(1);
}

// Set environment variable for connection
process.env.VINC_TENANT_ID = tenantId;
const dbName = `vinc-${tenantId}`;

async function clearBrands() {
  // Required environment variables (no fallbacks)
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("❌ Error: VINC_MONGO_URL environment variable is required");
    process.exit(1);
  }

  console.log("\n🗑️  CLEAR ALL BRANDS");
  console.log("=".repeat(60));
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Database: ${dbName}`);
  console.log(`Collection: brands`);
  console.log("=".repeat(60) + "\n");

  console.log("⚠️  WARNING: This will delete ALL brand documents from MongoDB!");
  console.log("Press Ctrl+C within 3 seconds to cancel...\n");

  // Give user 3 seconds to cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // Connect to tenant database
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUrl, { dbName });
    console.log(`✅ Connected to database: ${dbName}\n`);

    const before = await BrandModel.countDocuments();
    console.log(`  🏷️  brands before: ${before}`);

    const deleteResult = await BrandModel.deleteMany({});
    console.log(`     ✅ Deleted ${deleteResult.deletedCount} brands`);

    const after = await BrandModel.countDocuments();
    console.log(`  🏷️  brands after: ${after}\n`);

    console.log("=".repeat(60));
    console.log("✨ CLEANUP COMPLETE");
    console.log("=".repeat(60));
    console.log(`Tenant: ${tenantId}`);
    console.log(`MongoDB brands deleted: ${deleteResult.deletedCount}`);
    console.log("=".repeat(60) + "\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

clearBrands();
