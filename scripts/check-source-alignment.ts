/**
 * Check if source stats are aligned with actual product count
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { ImportJobModel } from "../src/lib/db/models/import-job";

async function checkAlignment() {
  try {
    await connectToDatabase();

    console.log("🔍 Checking PIM data alignment...\n");

    // Get the api-batch-import source
    const source = await ImportSourceModel.findOne({ source_id: "api-batch-import" });

    if (!source) {
      console.log("❌ Source 'api-batch-import' not found");
      process.exit(1);
    }

    // Count actual products from this source
    const actualProductCount = await PIMProductModel.countDocuments({
      "source.source_id": source.source_id,
      isCurrent: true,
    });

    // Count actual import jobs
    const actualJobCount = await ImportJobModel.countDocuments({
      source_id: source.source_id,
    });

    console.log("📊 Source: api-batch-import\n");

    console.log("Stats in database:");
    console.log(`   Total imports (stats): ${source.stats.total_imports}`);
    console.log(`   Total products (stats): ${source.stats.total_products}`);
    console.log(`   Last import status: ${source.stats.last_import_status}`);
    console.log(`   Last import at: ${source.stats.last_import_at}\n`);

    console.log("Actual counts:");
    console.log(`   Actual products in DB: ${actualProductCount}`);
    console.log(`   Actual import jobs: ${actualJobCount}\n`);

    if (source.stats.total_products === actualProductCount && source.stats.total_imports === actualJobCount) {
      console.log("✅ Stats are aligned!");
    } else {
      console.log("⚠️  Stats are NOT aligned!");
      console.log("\nTo fix this, you can either:");
      console.log("1. Reset stats to match actual data");
      console.log("2. Delete the source and recreate it");
    }

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkAlignment();
