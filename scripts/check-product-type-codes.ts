#!/usr/bin/env npx tsx
/**
 * Check if PIM Products have ProductType code field populated
 *
 * Usage:
 *   npx tsx scripts/check-product-type-codes.ts <tenant-id>
 *
 * Example:
 *   npx tsx scripts/check-product-type-codes.ts hidros-it
 */

import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error("Usage: npx tsx scripts/check-product-type-codes.ts <tenant-id>");
    process.exit(1);
  }

  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("Error: VINC_MONGO_URL environment variable is required");
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;
  console.log(`\n🔍 Checking ProductType codes in PIM Products for tenant: ${tenantId}`);
  console.log(`   Database: ${dbName}\n`);

  try {
    await mongoose.connect(mongoUrl, { dbName });
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    const productsCollection = db.collection("pimproducts");

    // Count products with product_type
    const totalWithProductType = await productsCollection.countDocuments({
      isCurrent: true,
      "product_type.product_type_id": { $exists: true },
    });

    // Count products with product_type.code populated
    const withCode = await productsCollection.countDocuments({
      isCurrent: true,
      "product_type.product_type_id": { $exists: true },
      "product_type.code": { $exists: true, $ne: null, $ne: "" },
    });

    // Count products with product_type but NO code
    const withoutCode = await productsCollection.countDocuments({
      isCurrent: true,
      "product_type.product_type_id": { $exists: true },
      $or: [
        { "product_type.code": { $exists: false } },
        { "product_type.code": null },
        { "product_type.code": "" },
      ],
    });

    console.log("📊 Results:");
    console.log(`   Total products with ProductType: ${totalWithProductType}`);
    console.log(`   ✅ With code field populated: ${withCode}`);
    console.log(`   ❌ Missing code field: ${withoutCode}`);

    if (withCode > 0) {
      // Show some examples of products with codes
      console.log("\n📦 Sample products with ProductType code:");
      const samples = await productsCollection
        .find({
          isCurrent: true,
          "product_type.code": { $exists: true, $ne: null, $ne: "" },
        })
        .limit(5)
        .project({
          entity_code: 1,
          "product_type.product_type_id": 1,
          "product_type.code": 1,
          "product_type.name": 1,
        })
        .toArray();

      for (const p of samples) {
        const ptName = typeof p.product_type?.name === "string"
          ? p.product_type.name
          : p.product_type?.name?.it || p.product_type?.name?.en || "Unknown";
        console.log(`   - ${p.entity_code}: ProductType "${ptName}" (code: ${p.product_type?.code})`);
      }
    }

    if (withoutCode > 0) {
      // Show some examples of products missing codes
      console.log("\n⚠️  Sample products MISSING ProductType code:");
      const missing = await productsCollection
        .find({
          isCurrent: true,
          "product_type.product_type_id": { $exists: true },
          $or: [
            { "product_type.code": { $exists: false } },
            { "product_type.code": null },
            { "product_type.code": "" },
          ],
        })
        .limit(5)
        .project({
          entity_code: 1,
          "product_type.product_type_id": 1,
          "product_type.name": 1,
        })
        .toArray();

      for (const p of missing) {
        const ptName = typeof p.product_type?.name === "string"
          ? p.product_type.name
          : p.product_type?.name?.it || p.product_type?.name?.en || "Unknown";
        console.log(`   - ${p.entity_code}: ProductType "${ptName}" (id: ${p.product_type?.product_type_id})`);
      }
    }

    console.log("");
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB\n");
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
