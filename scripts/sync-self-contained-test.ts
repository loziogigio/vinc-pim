#!/usr/bin/env tsx
/**
 * Sync self-contained test products to Solr
 * Tests hierarchy path generation
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";
import { projectConfig } from "../src/config/project.config";

async function syncTestProducts() {
  try {
    console.log("🔄 SYNCING SELF-CONTAINED TEST PRODUCTS TO SOLR");
    console.log("=".repeat(60) + "\n");

    // Connect to MongoDB
    await connectToDatabase();
    console.log("✅ Connected to MongoDB\n");

    // Get our test products
    const products = await PIMProductModel.find({
      entity_code: { $in: ["DRILL-BOSCH-001", "DRILL-BOSCH-002-RED"] }
    }).lean();

    console.log(`📋 Found ${products.length} test products to sync\n`);

    if (products.length === 0) {
      console.log("⚠️  No test products found. Run import-self-contained-test.ts first.");
      process.exit(1);
    }

    // Initialize Solr adapter
    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;

    const solrAdapter = new SolrAdapter({
      marketplace_id: "solr",
      marketplace_name: "Solr",
      custom_config: {
        solr_url: solrUrl,
        solr_core: projectConfig().solrCore,
      },
    });

    console.log(`🔍 Solr URL: ${solrUrl}/${projectConfig().solrCore}\n`);
    console.log("🔄 Indexing products to Solr...\n");

    // Sync products
    const result = await solrAdapter.bulkIndexProducts(products as any[], {
      batchSize: 10
    });

    console.log("\n" + "=".repeat(60));
    console.log("📊 Sync Results");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${result.success}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log(`📦 Total: ${products.length}`);

    if (result.errors && result.errors.length > 0) {
      console.log("\n❌ Errors:");
      result.errors.forEach(err => {
        console.log(`  - ${err}`);
      });
    }

    // Verify in Solr
    console.log("\n" + "=".repeat(60));
    console.log("🔍 Verifying Solr Structure");
    console.log("=".repeat(60) + "\n");

    // Get one product from Solr to inspect its structure
    const verifyUrl = `${solrUrl}/${projectConfig().solrCore}/select?q=entity_code:DRILL-BOSCH-001&rows=1&wt=json`;
    const response = await fetch(verifyUrl);
    const data = await response.json();

    if (data.response.numFound > 0) {
      const doc = data.response.docs[0];
      console.log("✅ Product DRILL-BOSCH-001 found in Solr\n");
      console.log("📊 Hierarchy Fields:\n");

      // Category hierarchy
      if (doc.category_path) {
        console.log("✅ category_path:");
        doc.category_path.forEach((path: string) => console.log(`   - ${path}`));
      }
      if (doc.category_ancestors) {
        console.log("✅ category_ancestors:", doc.category_ancestors.join(", "));
      }
      if (doc.category_breadcrumb_it) {
        console.log("✅ category_breadcrumb_it:", doc.category_breadcrumb_it.join(" > "));
      }
      if (doc.category_breadcrumb_en) {
        console.log("✅ category_breadcrumb_en:", doc.category_breadcrumb_en.join(" > "));
      }

      console.log();

      // Brand hierarchy
      if (doc.brand_path) {
        console.log("✅ brand_path:");
        doc.brand_path.forEach((path: string) => console.log(`   - ${path}`));
      }
      if (doc.brand_family) {
        console.log("✅ brand_family:", doc.brand_family);
      }

      console.log();

      // Product type hierarchy
      if (doc.product_type_path) {
        console.log("✅ product_type_path:");
        doc.product_type_path.forEach((path: string) => console.log(`   - ${path}`));
      }

      console.log();

      // Collections
      if (doc.collection_paths) {
        console.log("✅ collection_paths:", doc.collection_paths.length, "collections");
      }

      // Tags
      if (doc.tag_groups) {
        console.log("✅ tag_groups:", doc.tag_groups.join(", "));
      }
      if (doc.tag_categories) {
        console.log("✅ tag_categories:", doc.tag_categories.join(", "));
      }
    } else {
      console.log("⚠️  Product not found in Solr after indexing");
    }

    // Count total docs in Solr
    const countUrl = `${solrUrl}/${projectConfig().solrCore}/select?q=*:*&rows=0&wt=json`;
    const countResponse = await fetch(countUrl);
    const countData = await countResponse.json();

    console.log("\n" + "=".repeat(60));
    console.log(`📊 Total documents in Solr: ${countData.response.numFound}`);
    console.log("=".repeat(60));

    console.log("\n💡 Next Steps:");
    console.log("   1. Test hierarchical faceting queries");
    console.log("   2. Test category breadcrumb navigation");
    console.log("   3. Test brand family filtering\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal Error:", error);
    process.exit(1);
  }
}

syncTestProducts();
