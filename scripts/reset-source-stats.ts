/**
 * Reset source stats to match actual data
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { ImportJobModel } from "../src/lib/db/models/import-job";

async function resetStats() {
  try {
    await connectToDatabase();

    console.log("🔄 Resetting source stats...\n");

    // Get all sources
    const sources = await ImportSourceModel.find({});

    for (const source of sources) {
      // Count actual products
      const actualProductCount = await PIMProductModel.countDocuments({
        "source.source_id": source.source_id,
        isCurrent: true,
      });

      // Count actual jobs
      const actualJobCount = await ImportJobModel.countDocuments({
        source_id: source.source_id,
      });

      // Get last successful job
      const lastJob = await ImportJobModel.findOne({
        source_id: source.source_id,
        status: { $in: ["completed", "partial"] },
      }).sort({ completed_at: -1 });

      // Update stats
      await ImportSourceModel.updateOne(
        { source_id: source.source_id },
        {
          $set: {
            "stats.total_imports": actualJobCount,
            "stats.total_products": actualProductCount,
            "stats.last_import_at": lastJob?.completed_at,
            "stats.last_import_status": lastJob
              ? lastJob.failed_rows > 0
                ? "partial"
                : "success"
              : undefined,
          },
        }
      );

      console.log(`✅ ${source.source_id}:`);
      console.log(`   Total imports: ${source.stats.total_imports} → ${actualJobCount}`);
      console.log(`   Total products: ${source.stats.total_products} → ${actualProductCount}`);
    }

    console.log("\n✨ All source stats have been reset!");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

resetStats();
