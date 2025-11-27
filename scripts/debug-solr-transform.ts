#!/usr/bin/env tsx
/**
 * Debug Solr transformation
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";
import { projectConfig } from "../src/config/project.config";
import { writeFileSync } from "fs";

async function debugTransform() {
  try {
    await connectToDatabase();

    const product = await PIMProductModel.findOne(
      { entity_code: "DRILL-BOSCH-001" }
    ).lean();

    if (!product) {
      console.log("Product not found");
      process.exit(1);
    }

    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;

    const solrAdapter = new SolrAdapter({
      marketplace_id: "solr",
      marketplace_name: "Solr",
      custom_config: {
        solr_url: solrUrl,
        solr_core: projectConfig.solrCore,
      },
    });

    console.log("🔄 Transforming product to Solr document...\n");

    const doc = await solrAdapter.transformProduct(product as any);

    // Save to file for inspection
    writeFileSync("solr-document-debug.json", JSON.stringify(doc, null, 2));

    console.log("📊 Hierarchy Fields:\n");
    console.log("category_path:", doc.category_path);
    console.log("category_ancestors:", doc.category_ancestors);
    console.log("category_level:", doc.category_level);
    console.log("\nbrand_path:", doc.brand_path);
    console.log("brand_ancestors:", doc.brand_ancestors);
    console.log("brand_family:", doc.brand_family);
    console.log("\nproduct_type_path:", doc.product_type_path);
    console.log("product_type_ancestors:", doc.product_type_ancestors);
    console.log("\ncollection_paths:", doc.collection_paths);
    console.log("tag_groups:", doc.tag_groups);
    console.log("tag_categories:", doc.tag_categories);

    console.log("\n✅ Document saved to solr-document-debug.json");

    // Try to index just this one document
    console.log("\n🔄 Attempting to index to Solr...");
    const updateUrl = `${solrUrl}/${projectConfig.solrCore}/update?commit=true`;
    const response = await fetch(updateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([doc]),
    });

    if (response.ok) {
      console.log("✅ Document indexed successfully!");
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed with status ${response.status}`);
      console.log("Error response:", errorText);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

debugTransform();
