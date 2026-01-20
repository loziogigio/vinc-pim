/**
 * Migration Script: Add is_sellable to existing packaging options
 *
 * This script adds `is_sellable: true` to all existing packaging options
 * that don't have the field set. This is optional since the UI and API
 * already treat undefined as true.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-is-sellable.ts   # Preview changes
 *   npx tsx scripts/migrate-is-sellable.ts                # Apply changes
 *
 * Environment:
 *   VINC_MONGO_URL - MongoDB connection URL
 *   VINC_MONGO_DB_OVERRIDE - Database name (optional, defaults to VINC_TENANT_ID)
 *   VINC_TENANT_ID - Tenant ID (used if VINC_MONGO_DB_OVERRIDE not set)
 *   DRY_RUN - Set to "true" to preview without making changes
 */

import "dotenv/config";
import { MongoClient } from "mongodb";

const MONGO_URL = process.env.VINC_MONGO_URL || "mongodb://localhost:27017";
const DB_NAME =
  process.env.VINC_MONGO_DB_OVERRIDE ||
  (process.env.VINC_TENANT_ID ? `vinc-${process.env.VINC_TENANT_ID}` : "vinc-dfl-eventi-it");
const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  console.log("========================================");
  console.log("  Migration: Add is_sellable to packaging options");
  console.log("========================================");
  console.log(`Database: ${DB_NAME}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log("");

  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection("pimproducts");

    // Find all products with packaging_options that have at least one item missing is_sellable
    const query = {
      packaging_options: {
        $elemMatch: {
          is_sellable: { $exists: false },
        },
      },
    };

    const productsToUpdate = await collection.find(query).toArray();

    console.log(`Found ${productsToUpdate.length} products with packaging options missing is_sellable`);
    console.log("");

    if (productsToUpdate.length === 0) {
      console.log("No migration needed - all packaging options have is_sellable field.");
      return;
    }

    // Preview changes
    console.log("Products to update:");
    for (const product of productsToUpdate) {
      const packagingCount = (product.packaging_options || []).filter(
        (p: any) => p.is_sellable === undefined
      ).length;
      console.log(`  - ${product.entity_code}: ${packagingCount} packaging option(s) to update`);
    }
    console.log("");

    if (DRY_RUN) {
      console.log("DRY RUN - No changes made. Run without DRY_RUN=true to apply changes.");
      return;
    }

    // Apply migration
    console.log("Applying migration...");

    let updatedCount = 0;
    let packagingUpdated = 0;

    for (const product of productsToUpdate) {
      const updatedOptions = (product.packaging_options || []).map((pkg: any) => {
        if (pkg.is_sellable === undefined) {
          packagingUpdated++;
          return { ...pkg, is_sellable: true };
        }
        return pkg;
      });

      await collection.updateOne(
        { _id: product._id },
        { $set: { packaging_options: updatedOptions } }
      );

      updatedCount++;
    }

    console.log("");
    console.log("========================================");
    console.log("  MIGRATION COMPLETE");
    console.log("========================================");
    console.log(`  Products updated: ${updatedCount}`);
    console.log(`  Packaging options updated: ${packagingUpdated}`);

  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
