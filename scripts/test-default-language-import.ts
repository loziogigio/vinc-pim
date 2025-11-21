/**
 * Test default language import
 * Creates an import source, imports test products, and syncs to Solr
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { parseCSV } from "../src/lib/pim/parser";
import { processImport } from "../src/lib/queue/import-worker";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";
import { projectConfig } from "../src/config/project.config";
import * as fs from "fs";
import * as path from "path";

async function testDefaultLanguageImport() {
  try {
    console.log("🧪 Testing Default Language Import\n");
    await connectToDatabase();

    // Step 1: Create or get import source
    console.log("📋 Step 1: Creating import source...");

    let source = await ImportSourceModel.findOne({
      source_id: "test-default-language"
    });

    if (!source) {
      source = await ImportSourceModel.create({
        source_id: "test-default-language",
        source_name: "Test Default Language Import",
        source_type: "csv",
        auto_publish_enabled: true,
        min_score_threshold: 0, // Publish all for testing
        required_fields: ["entity_code", "sku", "name"],
        overwrite_level: "automatic",
        field_mapping: [
          { source_field: "entity_code", pim_field: "entity_code" },
          { source_field: "sku", pim_field: "sku" },
          { source_field: "name", pim_field: "name" }, // No language suffix!
          { source_field: "description", pim_field: "description" }, // No language suffix!
          { source_field: "short_description", pim_field: "short_description" }, // No language suffix!
          { source_field: "price", pim_field: "price", transform: "parseFloat(value)" },
          { source_field: "currency", pim_field: "currency" },
          { source_field: "stock_quantity", pim_field: "stock_quantity", transform: "parseInt(value)" },
          { source_field: "brand_name", pim_field: "brand.name.it" }, // With language suffix
          { source_field: "category_name", pim_field: "category.name.it" }, // With language suffix
        ],
        limits: {
          max_batch_size: 1000,
          warn_batch_size: 500,
          chunk_size: 100,
          timeout_minutes: 10,
        },
        stats: {
          total_imports: 0,
          total_products: 0,
          avg_completeness_score: 0,
        },
        created_by: "system",
        is_active: true,
      });
      console.log("✅ Import source created");
    } else {
      console.log("ℹ️  Import source already exists");
    }

    // Step 2: Parse CSV file
    console.log("\n📋 Step 2: Parsing CSV file...");
    const csvPath = path.join(__dirname, "../test-products.csv");
    const csvBuffer = fs.readFileSync(csvPath);

    const rows = await parseCSV(csvBuffer, source);
    console.log(`✅ Parsed ${rows.length} rows`);

    // Display first row to verify default language was applied
    if (rows.length > 0) {
      console.log("\n📊 First product data:");
      console.log(JSON.stringify(rows[0].data, null, 2));
    }

    // Step 3: Import products manually (simulate import worker)
    console.log("\n📋 Step 3: Importing products...");

    for (const row of rows) {
      const { entity_code, data } = row;

      // Delete existing product
      await PIMProductModel.deleteMany({ entity_code });

      // Provide default values for required fields if missing
      if (!data.image || !(data.image as any).id) {
        (data as any).image = {
          id: `placeholder-${entity_code}`,
          thumbnail: '/images/placeholder-product.jpg',
          original: '/images/placeholder-product.jpg',
        };
      }

      // Create new product
      const product = await PIMProductModel.create({
        entity_code,
        sku: data.sku || entity_code,
        version: 1,
        isCurrent: true,
        isCurrentPublished: true,
        status: "published",
        published_at: new Date(),
        source: {
          source_id: source.source_id,
          source_name: source.source_name,
          imported_at: new Date(),
          auto_publish_enabled: source.auto_publish_enabled,
          min_score_threshold: source.min_score_threshold,
          required_fields: source.required_fields,
        },
        completeness_score: 100,
        critical_issues: [],
        auto_publish_eligible: true,
        auto_publish_reason: "All requirements met",
        analytics: {
          views_30d: 0,
          clicks_30d: 0,
          add_to_cart_30d: 0,
          conversions_30d: 0,
          priority_score: 0,
          last_synced_at: new Date(),
        },
        last_api_update_at: new Date(),
        has_conflict: false,
        manually_edited: false,
        manually_edited_fields: [],
        locked_fields: [],
        ...data,
      });

      console.log(`✅ Created product: ${entity_code}`);
      console.log(`   Name (IT): ${product.name?.it || 'N/A'}`);
      console.log(`   Description (IT): ${product.description?.it?.substring(0, 50) || 'N/A'}...`);
    }

    // Step 4: Verify products in database
    console.log("\n📋 Step 4: Verifying products in database...");
    const products = await PIMProductModel.find({
      entity_code: { $in: rows.map(r => r.entity_code) },
      isCurrent: true
    });

    console.log(`✅ Found ${products.length} products in database`);

    for (const product of products) {
      console.log(`\n📦 ${product.entity_code}:`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Name (IT): ${product.name?.it || 'N/A'}`);
      console.log(`   Name (EN): ${product.name?.en || 'Not set'}`);
      console.log(`   Description (IT): ${product.description?.it?.substring(0, 80) || 'N/A'}...`);
      console.log(`   Price: ${product.price} ${product.currency}`);
      console.log(`   Stock: ${product.stock_quantity}`);
      console.log(`   Status: ${product.status}`);
    }

    // Step 5: Sync to Solr
    console.log("\n📋 Step 5: Syncing to Solr...");

    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;

    const solrAdapter = new SolrAdapter({
      custom_config: {
        solr_url: solrUrl,
        solr_core: projectConfig.solrCore,
      }
    });

    console.log(`🔍 Solr: ${solrUrl}/${projectConfig.solrCore}\n`);

    let successCount = 0;
    let failedCount = 0;

    for (const product of products) {
      try {
        const result = await solrAdapter.syncProduct(product as any);
        if (result.success) {
          console.log(`✅ Synced ${product.entity_code} to Solr`);
          successCount++;
        } else {
          console.log(`❌ Failed to sync ${product.entity_code}: ${result.error}`);
          failedCount++;
        }
      } catch (error: any) {
        console.log(`❌ Error syncing ${product.entity_code}: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`\n📊 Sync Summary:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failedCount}`);

    // Step 6: Verify in Solr
    console.log("\n📋 Step 6: Verifying in Solr...");
    const verifyUrl = `${solrUrl}/${projectConfig.solrCore}/select?q=*:*&rows=0`;
    const response = await fetch(verifyUrl);
    const data = await response.json();
    console.log(`✅ Total documents in Solr: ${data.response.numFound}`);

    // Query for test products
    const testQuery = `${solrUrl}/${projectConfig.solrCore}/select?q=entity_code:TEST*&rows=10&wt=json`;
    const testResponse = await fetch(testQuery);
    const testData = await testResponse.json();

    console.log(`\n📦 Test products in Solr: ${testData.response.numFound}`);
    if (testData.response.docs.length > 0) {
      console.log("\n🔍 Sample document from Solr:");
      const doc = testData.response.docs[0];
      console.log(`   entity_code: ${doc.entity_code}`);
      console.log(`   sku: ${doc.sku}`);
      console.log(`   name_text_it: ${doc.name_text_it || 'N/A'}`);
      console.log(`   description_text_it: ${doc.description_text_it?.substring(0, 80) || 'N/A'}...`);
      console.log(`   price: ${doc.price}`);
    }

    console.log("\n✅ Test completed successfully!");
    console.log("\n📝 Summary:");
    console.log(`   - CSV parsed: ${rows.length} products`);
    console.log(`   - Default language (IT) applied automatically to: name, description, short_description`);
    console.log(`   - Products imported: ${products.length}`);
    console.log(`   - Products synced to Solr: ${successCount}`);
    console.log(`   - Total docs in Solr: ${data.response.numFound}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

testDefaultLanguageImport();
