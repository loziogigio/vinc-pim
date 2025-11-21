/**
 * Clear all products from MongoDB and Solr
 * WARNING: This will delete all PIM products!
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function clearProducts() {
  try {
    await connectToDatabase();

    console.log("⚠️  WARNING: This will delete ALL PIM products!");
    console.log("🔄 Starting cleanup...\n");

    // Clear MongoDB
    console.log("📦 Clearing MongoDB PIMProduct collection...");
    const deleteResult = await PIMProductModel.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} products from MongoDB\n`);

    // Clear Solr
    console.log("🔍 Clearing Solr search index...");
    const solrUrl = process.env.SOLR_URL || "http://localhost:8983/solr";
    // Core name matches MongoDB database name
    const coreName = process.env.SOLR_CORE || process.env.MONGODB_DATABASE || "mycore";

    console.log(`   Solr URL: ${solrUrl}`);
    console.log(`   Core: ${coreName}`);

    const deleteUrl = `${solrUrl}/${coreName}/update?commit=true`;

    const response = await fetch(deleteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
      },
      body: "<delete><query>*:*</query></delete>",
    });

    if (response.ok) {
      console.log(`✅ Cleared Solr search index: ${coreName}\n`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to clear Solr: ${response.statusText}`);
      console.error(`   Error: ${errorText}\n`);
    }

    console.log("✨ Cleanup complete!");
    console.log("\nSummary:");
    console.log(`- MongoDB: ${deleteResult.deletedCount} products deleted`);
    console.log(`- Solr: All documents removed`);

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

clearProducts();
