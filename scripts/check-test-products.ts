/**
 * Check test products to verify default language was applied
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { ImportJobModel } from "../src/lib/db/models/import-job";
import { projectConfig } from "../src/config/project.config";

async function checkTestProducts() {
  try {
    console.log("🔍 Checking test products...\n");
    await connectToDatabase();

    // Check latest import job
    console.log("📋 Latest import jobs:");
    const jobs = await ImportJobModel.find({ source_id: "test-default-lang" })
      .sort({ created_at: -1 })
      .limit(5)
      .lean();

    if (jobs.length === 0) {
      console.log("⚠️  No import jobs found for source 'test-default-lang'");
      return;
    }

    console.table(jobs.map(j => ({
      job_id: j.job_id,
      status: j.status,
      total: j.total_rows,
      successful: j.successful_rows,
      failed: j.failed_rows,
      created: j.created_at?.toISOString().substring(0, 16)
    })));

    const latestJob = jobs[0];
    console.log(`\n📦 Latest job: ${latestJob.job_id}`);
    console.log(`   Status: ${latestJob.status}`);
    console.log(`   Total rows: ${latestJob.total_rows || 0}`);
    console.log(`   Successful: ${latestJob.successful_rows || 0}`);
    console.log(`   Failed: ${latestJob.failed_rows || 0}`);

    if (latestJob.status === "pending") {
      console.log("\n⏳ Job is still pending. The import worker may not be running.");
      console.log("💡 Start the import worker with: pnpm worker:import");
    } else if (latestJob.status === "processing") {
      console.log("\n⏳ Job is currently processing...");
    }

    // Check test products
    console.log("\n📋 Test Products (TEST*):");
    const products = await PIMProductModel.find({
      entity_code: /^TEST/,
      isCurrent: true
    }).sort({ entity_code: 1 });

    if (products.length === 0) {
      console.log("⚠️  No test products found");
      console.log("💡 Products may not have been imported yet");
      process.exit(0);
    }

    console.log(`✅ Found ${products.length} test products\n`);

    for (const product of products) {
      console.log(`📦 ${product.entity_code}:`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Status: ${product.status}`);

      // Check multilingual fields
      console.log(`\n   Multilingual Fields:`);

      if (product.name) {
        console.log(`   📝 Name:`);
        if (typeof product.name === 'object') {
          Object.keys(product.name).forEach(lang => {
            console.log(`      [${lang.toUpperCase()}]: ${(product.name as any)[lang]}`);
          });
        } else {
          console.log(`      [plain]: ${product.name} ⚠️ Should be an object!`);
        }
      }

      if (product.description) {
        console.log(`   📝 Description:`);
        if (typeof product.description === 'object') {
          Object.keys(product.description).forEach(lang => {
            const desc = (product.description as any)[lang];
            console.log(`      [${lang.toUpperCase()}]: ${desc?.substring(0, 60)}...`);
          });
        } else {
          console.log(`      [plain]: ${(product.description as any)?.substring(0, 60)}... ⚠️ Should be an object!`);
        }
      }

      if (product.short_description) {
        console.log(`   📝 Short Description:`);
        if (typeof product.short_description === 'object') {
          Object.keys(product.short_description).forEach(lang => {
            const desc = (product.short_description as any)[lang];
            console.log(`      [${lang.toUpperCase()}]: ${desc?.substring(0, 60)}...`);
          });
        } else {
          console.log(`      [plain]: ${(product.short_description as any)} ⚠️ Should be an object!`);
        }
      }

      // Check other fields
      console.log(`\n   Other Fields:`);
      console.log(`   💰 Price: ${product.price} ${product.currency || 'N/A'}`);
      console.log(`   📦 Stock: ${product.stock_quantity || 0}`);
      console.log(`   🏷️  Brand: ${product.brand?.name?.it || 'N/A'}`);
      console.log(`   📂 Category: ${product.category?.name?.it || 'N/A'}`);

      console.log(`\n   Source:`);
      console.log(`   📥 Imported from: ${product.source?.source_name || 'N/A'}`);
      console.log(`   📅 Imported at: ${product.source?.imported_at?.toISOString() || 'N/A'}`);

      console.log("\n" + "─".repeat(80) + "\n");
    }

    // Verify default language was applied
    console.log("🔍 Verification:");
    const allHaveItalian = products.every(p =>
      p.name?.it && p.description?.it
    );

    if (allHaveItalian) {
      console.log("✅ All products have Italian (IT) content for name and description");
      console.log(`   Default language '${projectConfig().defaultLanguage}' was applied correctly!`);
    } else {
      console.log("❌ Some products are missing Italian content");
      console.log("   The default language logic may not be working correctly");
    }

    // Check Solr sync
    console.log("\n📋 Solr Sync Status:");
    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;

    try {
      const testQuery = `${solrUrl}/${projectConfig().solrCore}/select?q=entity_code:TEST*&rows=10&wt=json`;
      const response = await fetch(testQuery);
      const data = await response.json();

      console.log(`✅ Found ${data.response.numFound} test products in Solr`);

      if (data.response.docs.length > 0) {
        const doc = data.response.docs[0];
        console.log(`\n📦 Sample Solr document (${doc.entity_code}):`);
        console.log(`   sku: ${doc.sku}`);
        console.log(`   name_text_it: ${doc.name_text_it || 'N/A'}`);
        console.log(`   description_text_it: ${doc.description_text_it?.substring(0, 60) || 'N/A'}...`);
        console.log(`   price: ${doc.price}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Could not connect to Solr: ${error.message}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkTestProducts();
