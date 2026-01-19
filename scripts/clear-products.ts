/**
 * Clear all products from MongoDB and Solr - Tenant-aware version
 *
 * Usage:
 *   npx tsx scripts/clear-products.ts <tenant-id>
 *   npx tsx scripts/clear-products.ts dfl-eventi-it
 *   npx tsx scripts/clear-products.ts hidros-it
 *
 * WARNING: This will delete all PIM products from both MongoDB and Solr!
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, "../.env") });

import mongoose from "mongoose";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error("❌ Error: Tenant ID is required");
  console.error("");
  console.error("Usage: npx tsx scripts/clear-products.ts <tenant-id>");
  console.error("");
  console.error("Examples:");
  console.error("  npx tsx scripts/clear-products.ts dfl-eventi-it");
  console.error("  npx tsx scripts/clear-products.ts hidros-it");
  process.exit(1);
}

// Set environment variable for connection
process.env.VINC_TENANT_ID = tenantId;
const dbName = `vinc-${tenantId}`;

async function clearProducts() {
  // Required environment variables (no fallbacks)
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("❌ Error: VINC_MONGO_URL environment variable is required");
    process.exit(1);
  }

  const solrUrl = process.env.SOLR_URL;
  if (!solrUrl) {
    console.error("❌ Error: SOLR_URL environment variable is required");
    process.exit(1);
  }

  const coreName = `vinc-${tenantId}`;

  console.log("\n🗑️  CLEAR ALL PRODUCTS");
  console.log("=".repeat(60));
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Database: ${dbName}`);
  console.log(`Solr Core: ${coreName}`);
  console.log("=".repeat(60) + "\n");

  console.log("⚠️  WARNING: This will delete ALL PIM products from MongoDB and Solr!");
  console.log("Press Ctrl+C within 3 seconds to cancel...\n");

  // Give user 3 seconds to cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // Connect to tenant database
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUrl, { dbName });
    console.log(`✅ Connected to database: ${dbName}\n`);

    console.log("🗑️  Clearing data...\n");

    // Clear MongoDB
    console.log("  📦 Clearing MongoDB pimproducts collection...");
    const deleteResult = await PIMProductModel.deleteMany({});
    console.log(`     ✅ Deleted ${deleteResult.deletedCount} products\n`);

    // Clear Solr
    console.log("  🔍 Clearing Solr search index...");
    console.log(`     URL: ${solrUrl}`);
    console.log(`     Core: ${coreName}`);

    const deleteUrl = `${solrUrl}/${coreName}/update?commit=true`;

    const response = await fetch(deleteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
      },
      body: "<delete><query>*:*</query></delete>",
    });

    if (response.ok) {
      console.log(`     ✅ Cleared all documents from Solr\n`);
    } else {
      const errorText = await response.text();
      console.error(`     ❌ Failed to clear Solr: ${response.statusText}`);
      console.error(`     Error: ${errorText}\n`);
    }

    console.log("=".repeat(60));
    console.log("✨ CLEANUP COMPLETE");
    console.log("=".repeat(60));
    console.log(`Tenant: ${tenantId}`);
    console.log(`MongoDB products deleted: ${deleteResult.deletedCount}`);
    console.log(`Solr: All documents removed`);
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

clearProducts();
