/**
 * Clean up all products from MongoDB and Solr, then test import
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { projectConfig } from "../src/config/project.config";

async function cleanup() {
  try {
    console.log("🧹 Cleaning up products...\n");
    await connectToDatabase();

    // Delete all products from MongoDB
    console.log("📋 Deleting all products from MongoDB...");
    const result = await PIMProductModel.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} products from MongoDB\n`);

    // Delete all products from Solr
    console.log("📋 Deleting all products from Solr...");
    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;
    const solrCore = projectConfig.solrCore;

    try {
      // Delete all documents
      const deleteUrl = `${solrUrl}/${solrCore}/update?commit=true`;
      const deleteResponse = await fetch(deleteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: { query: "*:*" } })
      });

      if (deleteResponse.ok) {
        console.log(`✅ Deleted all documents from Solr\n`);
      } else {
        console.log(`⚠️  Solr delete failed: ${deleteResponse.status} ${deleteResponse.statusText}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Could not connect to Solr: ${error.message}\n`);
    }

    console.log("✅ Cleanup complete!\n");
    console.log("📝 Next steps:");
    console.log("   1. Upload test CSV: cd scripts && ./upload-test-csv.sh");
    console.log("   2. Workers are already running to process the import");
    console.log("   3. Check results: npx tsx scripts/check-test-products.ts");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

cleanup();
