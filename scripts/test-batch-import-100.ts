/**
 * Test batch import: 100 products in batches of 20
 * Tests the /api/b2b/pim/import/api endpoint
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const TOTAL_PRODUCTS = 100;
const BATCH_SIZE = 20;
const TEST_SOURCE_ID = "test-api-source";

// Generate sample products
function generateProducts(startIndex: number, count: number) {
  const products = [];

  for (let i = startIndex; i < startIndex + count; i++) {
    const productNum = String(i).padStart(4, '0');

    products.push({
      sku: `TEST-BATCH-${productNum}`,
      entity_code: `PROD-BATCH-${productNum}`,
      product_model: `MODEL-${productNum}`,
      ean: [`590123412${productNum.slice(-4)}`],

      name: {
        it: `Prodotto Test ${i}`,
        de: `Testprodukt ${i}`,
        en: `Test Product ${i}`,
      },

      slug: {
        it: `prodotto-test-${i}`,
        de: `testprodukt-${i}`,
        en: `test-product-${i}`,
      },

      description: {
        it: `Descrizione del prodotto test numero ${i}`,
        de: `Beschreibung des Testprodukts Nummer ${i}`,
        en: `Description of test product number ${i}`,
      },

      short_description: {
        it: `Prodotto ${i} per test batch import`,
        de: `Produkt ${i} für Batch-Import-Test`,
        en: `Product ${i} for batch import test`,
      },

      brand: {
        id: `brand-test-${(i % 5) + 1}`,
        name: `Test Brand ${(i % 5) + 1}`,
        slug: `test-brand-${(i % 5) + 1}`,
      },

      category: {
        id: `cat-test-${(i % 10) + 1}`,
        name: {
          it: `Categoria Test ${(i % 10) + 1}`,
          de: `Testkategorie ${(i % 10) + 1}`,
          en: `Test Category ${(i % 10) + 1}`,
        },
        slug: {
          it: `categoria-test-${(i % 10) + 1}`,
          de: `testkategorie-${(i % 10) + 1}`,
          en: `test-category-${(i % 10) + 1}`,
        },
      },

      tags: [
        {
          id: "tag-test",
          name: {
            it: "Test",
            de: "Test",
            en: "Test",
          },
          slug: "test",
        },
        {
          id: "tag-batch",
          name: {
            it: "Importazione Batch",
            de: "Batch-Import",
            en: "Batch Import",
          },
          slug: "batch-import",
        },
      ],

      price: 99.99 + (i % 100),
      currency: "EUR",
      quantity: 50 + (i % 50),
      stock_status: "in_stock",

      features: {
        it: [
          `Caratteristica 1 per prodotto ${i}`,
          `Caratteristica 2 per prodotto ${i}`,
          "Test di importazione batch",
        ],
        en: [
          `Feature 1 for product ${i}`,
          `Feature 2 for product ${i}`,
          "Batch import test",
        ],
      },

      specifications: {
        it: [
          {
            key: "test_number",
            label: "Numero Test",
            value: String(i),
            uom: "n",
            category: "Test",
            order: 0,
          },
        ],
        en: [
          {
            key: "test_number",
            label: "Test Number",
            value: String(i),
            uom: "n",
            category: "Test",
            order: 0,
          },
        ],
      },

      status: "published",
      published_at: new Date().toISOString(),
    });
  }

  return products;
}

async function importBatch(batchNumber: number, products: any[], sourceId: string) {
  console.log(`\n📦 Batch ${batchNumber}: Importing ${products.length} products...`);
  console.log(`   Products: ${products[0].sku} to ${products[products.length - 1].sku}`);

  const startTime = Date.now();

  try {
    const response = await fetch(`${API_URL}/api/b2b/pim/import/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_id: sourceId,
        products,
      }),
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (response.ok && data.success) {
      console.log(`   ✅ Success in ${duration}ms`);
      console.log(`   Job ID: ${data.job_id}`);
      console.log(`   Summary: ${data.summary.successful} successful, ${data.summary.failed} failed, ${data.summary.auto_published} auto-published`);
      return { success: true, data, duration };
    } else {
      console.error(`   ❌ Failed:`, data.error || data.message);
      if (data.details) console.error(`   Details:`, data.details);
      return { success: false, error: data, duration };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`   ❌ Error:`, error.message);
    return { success: false, error: error.message, duration };
  }
}

async function ensureTestSource() {
  // Check if test source exists
  let source = await ImportSourceModel.findOne({ source_id: TEST_SOURCE_ID });

  if (!source) {
    console.log(`📝 Creating test import source: ${TEST_SOURCE_ID}`);
    source = await ImportSourceModel.create({
      source_id: TEST_SOURCE_ID,
      source_name: "Test API Import Source",
      source_type: "api",
      enabled: true,
      auto_publish_enabled: true,
      min_score_threshold: 50,
      required_fields: ["sku", "name"],
      field_mappings: {},
      created_by: "test-script",
      stats: {
        total_imports: 0,
        total_products: 0,
        last_import_at: null,
        last_import_status: null,
      },
    });
    console.log(`✅ Test source created\n`);
  } else {
    console.log(`✅ Using existing test source: ${TEST_SOURCE_ID}\n`);
  }

  return source.source_id;
}

async function main() {
  console.log("🚀 Batch Import Test: 100 products in batches of 20\n");
  console.log(`API URL: ${API_URL}/api/b2b/pim/import/api`);
  console.log(`Total Products: ${TOTAL_PRODUCTS}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Number of Batches: ${Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE)}\n`);

  await connectToDatabase();

  // Ensure test source exists
  const sourceId = await ensureTestSource();

  const results = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalAutoPublished = 0;
  let totalDuration = 0;

  // Process batches
  for (let i = 0; i < TOTAL_PRODUCTS; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const remainingProducts = TOTAL_PRODUCTS - i;
    const currentBatchSize = Math.min(BATCH_SIZE, remainingProducts);

    const products = generateProducts(i + 1, currentBatchSize);
    const result = await importBatch(batchNumber, products, sourceId);

    results.push(result);
    totalDuration += result.duration;

    if (result.success) {
      totalSuccess += result.data.summary.successful;
      totalFailed += result.data.summary.failed;
      totalAutoPublished += result.data.summary.auto_published || 0;
    }

    // Small delay between batches
    if (i + BATCH_SIZE < TOTAL_PRODUCTS) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 IMPORT SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total Batches Sent: ${results.length}`);
  console.log(`Successful Batches: ${results.filter(r => r.success).length}`);
  console.log(`Failed Batches: ${results.filter(r => !r.success).length}`);
  console.log(`Total Products Imported: ${totalSuccess}`);
  console.log(`Total Products Failed: ${totalFailed}`);
  console.log(`Total Auto-Published: ${totalAutoPublished}`);
  console.log(`Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`Average per Batch: ${(totalDuration / results.length).toFixed(0)}ms`);
  console.log(`Average per Product: ${(totalDuration / TOTAL_PRODUCTS).toFixed(0)}ms`);

  console.log("\n💡 Next Steps:");
  console.log("1. Check MongoDB for imported products");
  console.log("2. Verify product data at: http://localhost:3000/b2b/pim/products");
  console.log("3. Check source stats at: http://localhost:3000/b2b/pim/sources");
  console.log("4. Verify Solr sync (if enabled)");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
