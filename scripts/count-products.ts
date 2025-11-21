/**
 * Count products in MongoDB and Solr
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function countProducts() {
  await connectToDatabase();

  // Count MongoDB products
  const mongoCount = await PIMProductModel.countDocuments({});
  console.log(`\n📦 MongoDB: ${mongoCount} products`);

  // Count Solr documents
  const solrUrl = process.env.SOLR_URL || "http://localhost:8983/solr";
  const coreName = process.env.SOLR_CORE || process.env.MONGODB_DATABASE || "mycore";

  try {
    const response = await fetch(`${solrUrl}/${coreName}/select?q=*:*&rows=0`);
    const data = await response.json();
    console.log(`🔍 Solr: ${data.response.numFound} documents`);

    if (data.response.numFound === mongoCount) {
      console.log(`\n✅ Perfect sync: All ${mongoCount} products indexed in Solr!`);
    } else {
      console.log(`\n⚠️  Sync mismatch: ${mongoCount} in MongoDB, ${data.response.numFound} in Solr`);
    }
  } catch (error: any) {
    console.error(`❌ Solr error: ${error.message}`);
  }

  process.exit(0);
}

countProducts();
