/**
 * Clean Database - Remove all test products
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { ImportJobModel } from "../src/lib/db/models/import-job";

async function cleanDatabase() {
  try {
    await connectToDatabase();

    console.log("🧹 Cleaning database...\n");

    // Count before deletion
    const productCount = await PIMProductModel.countDocuments({});
    const jobCount = await ImportJobModel.countDocuments({});

    console.log(`📊 Current state:`);
    console.log(`   Products: ${productCount}`);
    console.log(`   Import Jobs: ${jobCount}\n`);

    // Delete all products
    const productsResult = await PIMProductModel.deleteMany({});
    console.log(`✅ Deleted ${productsResult.deletedCount} products`);

    // Delete all import jobs
    const jobsResult = await ImportJobModel.deleteMany({});
    console.log(`✅ Deleted ${jobsResult.deletedCount} import jobs`);

    console.log("\n✨ Database cleaned successfully!");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

cleanDatabase();
