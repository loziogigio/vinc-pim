/**
 * Check DFL database contents
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function check() {
  try {
    console.log("🔍 Checking vinc-dfl-eventi-it database...\n");
    await connectToDatabase("vinc-dfl-eventi-it");

    // Check import sources
    const sources = await ImportSourceModel.find({}).lean();
    console.log(`📋 Import sources: ${sources.length}`);
    sources.forEach((s: any) => {
      console.log(`   - ${s.source_id}: ${s.source_name}`);
    });

    // Check products
    const productCount = await PIMProductModel.countDocuments();
    console.log(`\n📦 Products: ${productCount}`);

    if (productCount > 0) {
      const sampleProducts = await PIMProductModel.find().limit(3).lean();
      console.log(`\n📌 Sample products:`);
      sampleProducts.forEach((p: any) => {
        console.log(`   - ${p.entity_code} (${p.sku}) - ${p.status}`);
      });
    }

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

check();
