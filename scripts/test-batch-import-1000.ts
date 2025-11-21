/**
 * Test batch import - 1000 products in batches of 100
 * Tests the batch import API endpoint with proper batch_id tracking
 */

const TOTAL_PRODUCTS = 1000;
const BATCH_SIZE = 100;
const API_BASE = "http://localhost:3000";

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
      status: "published",
    });
  }

  return products;
}

/**
 * Import a batch via API
 */
async function importBatch(
  products: any[],
  sourceId: string,
  batchId: string,
  batchPart: number,
  totalParts: number
): Promise<{ success: boolean; message: string }> {
  try {
    const requestBody = {
      products,
      source_id: sourceId,
      batch_id: batchId,
      sync_to_search: true,
      update_existing: true,
      batch_metadata: {
        batch_id: batchId,
        batch_part: batchPart,
        batch_total_parts: totalParts,
        batch_total_items: TOTAL_PRODUCTS,
      },
    };

    const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP ${response.status}: ${result.error || "Unknown error"}`,
      };
    }

    return {
      success: true,
      message: `Imported ${result.imported || products.length} products`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

async function runBatchImport() {
  const startTime = Date.now();
  const batchId = `batch_test_${Date.now()}`;

  try {
    console.log(`📦 Batch Import Test - ${TOTAL_PRODUCTS} Products\n`);
    console.log(`⚙️  Configuration:`);
    console.log(`   Total products: ${TOTAL_PRODUCTS}`);
    console.log(`   Batch size: ${BATCH_SIZE}`);
    console.log(`   Total batches: ${Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE)}`);
    console.log(`   Batch ID: ${batchId}`);
    console.log(`   API endpoint: ${API_BASE}/api/b2b/pim/import/api\n`);

    // Generate all products
    console.log(`🔨 Generating ${TOTAL_PRODUCTS} products...`);
    const allProducts = generateProducts(TOTAL_PRODUCTS);
    console.log(`✅ Products generated\n`);

    // Process in batches
    let totalSuccess = 0;
    let totalFailed = 0;

    const totalBatches = Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, TOTAL_PRODUCTS);
      const batch = allProducts.slice(start, end);
      const batchPart = i + 1;

      console.log(`📦 Batch ${batchPart}/${totalBatches} - Sending ${batch.length} products...`);
      const batchStartTime = Date.now();

      const result = await importBatch(
        batch,
        "test-default-lang",
        batchId,
        batchPart,
        totalBatches
      );

      const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);

      if (result.success) {
        totalSuccess += batch.length;
        console.log(`✅ Batch ${batchPart} complete in ${batchDuration}s - ${result.message}`);
      } else {
        totalFailed += batch.length;
        console.log(`❌ Batch ${batchPart} failed in ${batchDuration}s - ${result.message}`);
      }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgProductsPerSecond = (totalSuccess / parseFloat(totalDuration)).toFixed(2);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Final Results:`);
    console.log(`${"=".repeat(60)}`);
    console.log(`   Successfully imported: ${totalSuccess}/${TOTAL_PRODUCTS}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Total duration: ${totalDuration}s`);
    console.log(`   Average speed: ${avgProductsPerSecond} products/sec`);
    console.log(`${"=".repeat(60)}`);

    if (totalSuccess === TOTAL_PRODUCTS) {
      console.log(`\n✅ SUCCESS: All ${TOTAL_PRODUCTS} products imported!`);
      console.log(`\n📝 Query products by batch_id:`);
      console.log(`   db.getCollection('products').find({ 'source.batch_id': '${batchId}' }).count()`);
    } else {
      console.log(`\n⚠️  WARNING: Only ${totalSuccess}/${TOTAL_PRODUCTS} products imported successfully`);
    }

    process.exit(totalSuccess === TOTAL_PRODUCTS ? 0 : 1);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

runBatchImport();
