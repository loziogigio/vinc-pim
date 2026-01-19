/**
 * Clear all orders and customers from the database - Tenant-aware version
 *
 * Usage:
 *   npx tsx scripts/clear-all-data.ts <tenant-id>
 *   npx tsx scripts/clear-all-data.ts dfl-eventi-it
 *   npx tsx scripts/clear-all-data.ts hidros-it
 */

import mongoose from "mongoose";
import { config } from "dotenv";

config({ path: ".env" });

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error("❌ Error: Tenant ID is required");
  console.error("");
  console.error("Usage: npx tsx scripts/clear-all-data.ts <tenant-id>");
  console.error("");
  console.error("Examples:");
  console.error("  npx tsx scripts/clear-all-data.ts dfl-eventi-it");
  console.error("  npx tsx scripts/clear-all-data.ts hidros-it");
  process.exit(1);
}

// Build tenant database name
const dbName = `vinc-${tenantId}`;

async function clearAll() {
  // Required environment variables (no fallbacks)
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("❌ Error: VINC_MONGO_URL environment variable is required");
    process.exit(1);
  }

  console.log("\n🗑️  CLEAR ALL DATA");
  console.log("=".repeat(60));
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Database: ${dbName}`);
  console.log("=".repeat(60) + "\n");

  console.log("⚠️  WARNING: This will delete all orders, customers, and counters!");
  console.log("Press Ctrl+C within 3 seconds to cancel...\n");

  // Give user 3 seconds to cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(mongoUrl, { dbName });

  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ Failed to get database connection");
    process.exit(1);
  }

  console.log(`✅ Connected to database: ${db.databaseName}\n`);

  console.log("🗑️  Clearing data...\n");

  // Delete all from orders collection
  const ordersResult = await db.collection("orders").deleteMany({});
  console.log(`  Orders deleted: ${ordersResult.deletedCount}`);

  // Delete all from customers collection
  const customersResult = await db.collection("customers").deleteMany({});
  console.log(`  Customers deleted: ${customersResult.deletedCount}`);

  // Reset customer public code counter
  const customerCounterResult = await db.collection("counters").deleteMany({
    _id: { $regex: "^customer_public_code_" },
  } as any);
  console.log(`  Customer counters reset: ${customerCounterResult.deletedCount}`);

  // Reset cart/order counters
  const orderCounterResult = await db.collection("counters").deleteMany({
    _id: { $regex: "^(cart_number_|order_number_)" },
  } as any);
  console.log(`  Order/cart counters reset: ${orderCounterResult.deletedCount}`);

  await mongoose.disconnect();

  console.log("\n" + "=".repeat(60));
  console.log("✨ ALL DATA CLEARED");
  console.log("=".repeat(60));
  console.log(`Tenant: ${tenantId}`);
  console.log(`Orders deleted: ${ordersResult.deletedCount}`);
  console.log(`Customers deleted: ${customersResult.deletedCount}`);
  console.log(`Counters reset: ${customerCounterResult.deletedCount + orderCounterResult.deletedCount}`);
  console.log("=".repeat(60) + "\n");
}

clearAll().catch((err) => {
  console.error("\n❌ Error:", err.message);
  console.error(err);
  process.exit(1);
});
