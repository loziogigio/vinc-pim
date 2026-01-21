#!/usr/bin/env npx tsx
/**
 * Sync ProductType codes to PIM Products
 *
 * This script updates all products to include the ProductType `code` field
 * in their embedded product_type document.
 *
 * Usage:
 *   npx tsx scripts/sync-product-type-codes.ts <tenant-id>
 *
 * Example:
 *   npx tsx scripts/sync-product-type-codes.ts hidros-it
 */

import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error("Usage: npx tsx scripts/sync-product-type-codes.ts <tenant-id>");
    console.error("Example: npx tsx scripts/sync-product-type-codes.ts hidros-it");
    process.exit(1);
  }

  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("Error: VINC_MONGO_URL environment variable is required");
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;
  console.log(`\n🔄 Syncing ProductType codes for tenant: ${tenantId}`);
  console.log(`   Database: ${dbName}\n`);

  try {
    // Connect to MongoDB
    await mongoose.connect(mongoUrl, { dbName });
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    // Get all ProductTypes with codes
    const productTypesCollection = db.collection("producttypes");
    const productTypes = await productTypesCollection
      .find({ code: { $exists: true, $ne: null, $ne: "" } })
      .toArray();

    console.log(`📦 Found ${productTypes.length} ProductTypes with codes:\n`);

    if (productTypes.length === 0) {
      console.log("   No ProductTypes with codes found. Nothing to sync.");
      await mongoose.disconnect();
      return;
    }

    // Display ProductTypes to sync
    for (const pt of productTypes) {
      const name = typeof pt.name === "string" ? pt.name : pt.name?.it || pt.name?.en || "Unknown";
      console.log(`   - ${pt.code}: ${name} (${pt.product_type_id})`);
    }
    console.log("");

    // Update products for each ProductType
    const productsCollection = db.collection("pimproducts");
    let totalUpdated = 0;

    for (const productType of productTypes) {
      const productTypeId = productType.product_type_id;
      const code = productType.code;
      const name = typeof productType.name === "string"
        ? productType.name
        : productType.name?.it || productType.name?.en || "Unknown";

      // Find products with this product_type (support both field names)
      const query = {
        isCurrent: true,
        $or: [
          { "product_type.product_type_id": productTypeId },
          { "product_type.id": productTypeId },
        ],
      };

      const matchingProducts = await productsCollection.countDocuments(query);

      if (matchingProducts === 0) {
        console.log(`   ⏭️  ${code}: ${name} - No products to update`);
        continue;
      }

      // Update products to include the code
      const result = await productsCollection.updateMany(
        query,
        { $set: { "product_type.code": code } }
      );

      console.log(`   ✅ ${code}: ${name} - Updated ${result.modifiedCount} of ${matchingProducts} products`);
      totalUpdated += result.modifiedCount;
    }

    console.log(`\n🎉 Done! Updated ${totalUpdated} products total.\n`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB\n");
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
