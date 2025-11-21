/**
 * Large-scale batch import - 1000 products in batches of 250
 * Tests performance and reliability of batch import with Solr sync
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { projectConfig } from "../src/config/project.config";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";

const TOTAL_PRODUCTS = 1000;
const BATCH_SIZE = 250;

// Product categories and names for variety
const categories = [
  { prefix: "TOOL", names: ["Cacciavite", "Martello", "Pinza", "Trapano", "Sega", "Chiave", "Livella", "Metro"] },
  { prefix: "SAFE", names: ["Guanti", "Occhiali", "Casco", "Mascherina", "Scarpe", "Gilet", "Tappi"] },
  { prefix: "ELEC", names: ["Cavo", "Interruttore", "Presa", "Lampada", "Batteria", "Caricatore"] },
  { prefix: "HARD", names: ["Vite", "Bullone", "Rondella", "Dado", "Chiodo", "Tassello"] },
];

/**
 * Generate product data
 */
function generateProducts(count: number): any[] {
  const products = [];

  for (let i = 1; i <= count; i++) {
    const categoryIndex = i % categories.length;
    const category = categories[categoryIndex];
    const nameIndex = i % category.names.length;
    const name = category.names[nameIndex];

    const entityCode = `${category.prefix}-${String(i).padStart(4, "0")}`;
    const sku = `SKU-${String(i).padStart(4, "0")}`;
    const price = Math.round((Math.random() * 200 + 10) * 100) / 100;
    const stock = Math.floor(Math.random() * 500) + 10;

    products.push({
      entity_code: entityCode,
      sku,
      name: `${name} Professionale ${i}`,
      description: `${name} di alta qualità per uso professionale. Prodotto numero ${i}.`,
      short_description: `${name} professionale`,
      price,
      currency: "EUR",
      stock_quantity: stock,
    });
  }

  return products;
}

/**
 * Apply default language to multilingual fields
 */
function applyDefaultLanguage(data: any): void {
  const defaultLang = projectConfig.defaultLanguage;
  const MULTILINGUAL_FIELDS = ["name", "description", "short_description", "features", "specifications"];

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] && typeof data[field] === "string") {
      data[field] = { [defaultLang]: data[field] };
    }
  }
}

/**
 * Import a batch of products
 */
async function importBatch(
  products: any[],
  solrAdapter: any,
  source: any,
  batchNumber: number,
  totalBatches: number
): Promise<{ success: number; synced: number; failed: number }> {
  let successCount = 0;
  let syncedCount = 0;
  let failedCount = 0;

  console.log(`\n📦 Batch ${batchNumber}/${totalBatches} - Processing ${products.length} products...`);
  const batchStartTime = Date.now();

  for (const productData of products) {
    try {
      // Apply default language to multilingual fields
      applyDefaultLanguage(productData);

      // Delete existing
      await PIMProductModel.deleteMany({ entity_code: productData.entity_code });

      // Add required image field
      const image = {
        id: `placeholder-${productData.entity_code}`,
        thumbnail: "/images/placeholder-product.jpg",
        original: "/images/placeholder-product.jpg",
      };

      // Create product
      const createdProduct = await PIMProductModel.create({
        entity_code: productData.entity_code,
        sku: productData.sku,
        version: 1,
        isCurrent: true,
        isCurrentPublished: true,
        status: "published",
        published_at: new Date(),
        image,
        source: {
          source_id: source.source_id,
          source_name: source.source_name,
          imported_at: new Date(),
        },
        completeness_score: 100,
        auto_publish_eligible: true,
        analytics: {
          views_30d: 0,
          clicks_30d: 0,
          add_to_cart_30d: 0,
          conversions_30d: 0,
          priority_score: 0,
        },
        ...productData,
      });

      successCount++;

      // Sync to Solr
      try {
        const syncResult = await solrAdapter.syncProduct(createdProduct.toObject());
        if (syncResult.success) {
          // Update last_synced_at timestamp
          await PIMProductModel.updateOne(
            { _id: createdProduct._id },
            { $set: { "analytics.last_synced_at": new Date() } }
          );
          syncedCount++;
        }
      } catch (syncError: any) {
        // Continue processing even if sync fails
      }
    } catch (error: any) {
      failedCount++;
    }
  }

  const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
  const productsPerSecond = (products.length / parseFloat(batchDuration)).toFixed(2);

  console.log(`✅ Batch ${batchNumber} complete in ${batchDuration}s (${productsPerSecond} products/sec)`);
  console.log(`   Created: ${successCount}, Synced: ${syncedCount}, Failed: ${failedCount}`);

  return { success: successCount, synced: syncedCount, failed: failedCount };
}

async function batchImport() {
  const startTime = Date.now();

  try {
    console.log(`📦 Large-Scale Batch Import - ${TOTAL_PRODUCTS} Products\n`);
    console.log(`⚙️  Configuration:`);
    console.log(`   Total products: ${TOTAL_PRODUCTS}`);
    console.log(`   Batch size: ${BATCH_SIZE}`);
    console.log(`   Total batches: ${Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE)}\n`);

    await connectToDatabase();

    // Get source
    const source = await ImportSourceModel.findOne({ source_id: "test-default-lang" });
    if (!source) {
      throw new Error("Import source not found");
    }

    console.log(`✅ Using source: ${source.source_name}\n`);

    // Initialize Solr adapter
    console.log("🔍 Initializing Search Engine adapter...");
    const solrAdapter = new SolrAdapter({
      enabled: true,
      custom_config: {
        solr_url: process.env.SOLR_URL || "http://localhost:8983/solr",
        solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE || "mycore",
      },
    });
    await solrAdapter.initialize();
    console.log("✅ Search Engine adapter initialized");

    // Generate all products
    console.log(`\n🔨 Generating ${TOTAL_PRODUCTS} products...`);
    const allProducts = generateProducts(TOTAL_PRODUCTS);
    console.log(`✅ Products generated`);

    // Process in batches
    let totalSuccess = 0;
    let totalSynced = 0;
    let totalFailed = 0;

    const totalBatches = Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, TOTAL_PRODUCTS);
      const batch = allProducts.slice(start, end);

      const result = await importBatch(batch, solrAdapter, source, i + 1, totalBatches);

      totalSuccess += result.success;
      totalSynced += result.synced;
      totalFailed += result.failed;
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgProductsPerSecond = (TOTAL_PRODUCTS / parseFloat(totalDuration)).toFixed(2);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Final Results:`);
    console.log(`${"=".repeat(60)}`);
    console.log(`   MongoDB created: ${totalSuccess}/${TOTAL_PRODUCTS}`);
    console.log(`   Search Engine synced: ${totalSynced}/${totalSuccess}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Total duration: ${totalDuration}s`);
    console.log(`   Average speed: ${avgProductsPerSecond} products/sec`);
    console.log(`${"=".repeat(60)}`);

    if (totalSynced === totalSuccess && totalSuccess === TOTAL_PRODUCTS) {
      console.log(`\n✅ SUCCESS: All ${TOTAL_PRODUCTS} products imported and synced!`);
    } else if (totalSuccess === TOTAL_PRODUCTS) {
      console.log(`\n⚠️  WARNING: All products created but only ${totalSynced}/${totalSuccess} synced to search engine`);
    } else {
      console.log(`\n⚠️  WARNING: Only ${totalSuccess}/${TOTAL_PRODUCTS} products created successfully`);
    }

    console.log(`\n📝 All products have Italian (IT) as default language`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

batchImport();
