#!/usr/bin/env tsx
/**
 * Import self-contained test batch
 * Tests the new self-contained entity hierarchy architecture
 *
 * Clears MongoDB and Solr before importing
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

interface BatchData {
  batch_id: string;
  source_id: string;
  products: any[];
}

// Solr configuration from environment
const SOLR_URL = process.env.SOLR_URL || "http://localhost:8983/solr";
const SOLR_CORE = process.env.SOLR_CORE || "mycore";

async function clearSolr() {
  try {
    const deleteUrl = `${SOLR_URL}/${SOLR_CORE}/update?commit=true`;
    const response = await fetch(deleteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: { query: "*:*" } }),
    });

    if (!response.ok) {
      throw new Error(`Solr delete failed: ${response.status}`);
    }

    console.log("✅ Cleared Solr index\n");
  } catch (error: any) {
    console.warn(`⚠️  Could not clear Solr: ${error.message}`);
    console.warn("   (Solr might not be running or configured)\n");
  }
}

async function importSelfContainedBatch() {
  try {
    console.log("🧹 CLEARING DATA & IMPORTING SELF-CONTAINED TEST BATCH");
    console.log("=".repeat(60) + "\n");

    // Read test batch file
    const batchFile = resolve(process.cwd(), "test-self-contained-batch.json");
    const batchData: BatchData = JSON.parse(readFileSync(batchFile, "utf-8"));

    console.log(`📋 Batch ID: ${batchData.batch_id}`);
    console.log(`📦 Products: ${batchData.products.length}`);
    console.log(`🔗 Source: ${batchData.source_id}\n`);

    // Connect to MongoDB
    await connectToDatabase();
    console.log("✅ Connected to MongoDB\n");

    // Clear ALL products from MongoDB
    console.log("🗑️  Clearing ALL products from MongoDB...");
    const deleteResult = await PIMProductModel.deleteMany({});
    console.log(`   ✅ Deleted ${deleteResult.deletedCount} products\n`);

    // Clear Solr index
    console.log("🗑️  Clearing Solr index...");
    await clearSolr();

    // Import products directly
    let successCount = 0;
    let errorCount = 0;

    for (const productData of batchData.products) {
      try {
        console.log(`📦 Importing: ${productData.entity_code}`);

        // Add metadata
        const product = {
          ...productData,
          source: {
            source_id: batchData.source_id,
            source_name: "Self-Contained Test",
            batch_id: batchData.batch_id,
            imported_at: new Date(),
          },
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Upsert product
        await PIMProductModel.findOneAndUpdate(
          { entity_code: product.entity_code },
          product,
          { upsert: true, new: true }
        );

        successCount++;
        console.log(`   ✅ ${productData.name?.it || productData.name}\n`);
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ Error: ${error.message}\n`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Import Summary");
    console.log("=".repeat(60));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📦 Total: ${batchData.products.length}`);
    console.log("=".repeat(60) + "\n");

    // Verify MongoDB structure
    console.log("🔍 Verifying MongoDB structure...\n");

    const product1 = await PIMProductModel.findOne(
      { entity_code: "DRILL-BOSCH-001" }
    ).lean();

    if (product1) {
      console.log("✅ Product DRILL-BOSCH-001 found");
      console.log("\n📊 Self-Contained Fields:");

      if (product1.brand?.hierarchy) {
        console.log(`   ✅ brand.hierarchy: ${product1.brand.hierarchy.length} ancestors`);
      }
      if (product1.category?.hierarchy) {
        console.log(`   ✅ category.hierarchy: ${product1.category.hierarchy.length} ancestors`);
      }
      if (product1.product_type?.hierarchy) {
        console.log(`   ✅ product_type.hierarchy: ${product1.product_type.hierarchy.length} ancestors`);
      }
      if (product1.product_type?.inherited_features) {
        console.log(`   ✅ product_type.inherited_features: ${product1.product_type.inherited_features.length} features`);
      }
      if (product1.collections) {
        const withHierarchy = product1.collections.filter((c: any) => c.hierarchy).length;
        console.log(`   ✅ collections with hierarchy: ${withHierarchy}/${product1.collections.length}`);
      }
      if (product1.tags) {
        const withGroupData = product1.tags.filter((t: any) => t.tag_group_data).length;
        console.log(`   ✅ tags with group_data: ${withGroupData}/${product1.tags.length}`);
      }
    }

    const variant = await PIMProductModel.findOne(
      { entity_code: "DRILL-BOSCH-002-RED" }
    ).lean();

    if (variant) {
      console.log("\n✅ Variant DRILL-BOSCH-002-RED found");
      console.log("\n📊 Variant Fields:");
      if (variant.parent_product) {
        console.log(`   ✅ parent_product: ${variant.parent_product.entity_code}`);
      }
      if (variant.sibling_variants) {
        console.log(`   ✅ sibling_variants: ${variant.sibling_variants.length} variants`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Import complete!");
    console.log("=".repeat(60));
    console.log("\n💡 Next Steps:");
    console.log("   1. Index to Solr to see hierarchy fields");
    console.log("   2. Query Solr for category_path, brand_path, etc.");
    console.log("   3. Test hierarchical faceting\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal Error:", error);
    process.exit(1);
  }
}

// Run import
importSelfContainedBatch();
