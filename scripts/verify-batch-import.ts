/**
 * Verify batch import results
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function verifyBatch() {
  try {
    await connectToDatabase();

    const batch_id = process.argv[2] || "batch_test_1763722846877";

    const totalCount = await PIMProductModel.countDocuments({});
    const batchCount = await PIMProductModel.countDocuments({
      "source.batch_id": batch_id,
    });

    console.log("📊 Database Verification:");
    console.log(`   Total products: ${totalCount}`);
    console.log(`   Products in batch ${batch_id}: ${batchCount}`);

    // Sample product
    const sampleProduct = await PIMProductModel.findOne({
      "source.batch_id": batch_id,
    }).lean();

    if (sampleProduct) {
      console.log(`\n📦 Sample Product:`);
      console.log(`   Entity Code: ${sampleProduct.entity_code}`);
      console.log(`   SKU: ${sampleProduct.sku}`);
      console.log(`   Name: ${JSON.stringify(sampleProduct.name)}`);
      console.log(`   Price: ${sampleProduct.price} ${sampleProduct.currency}`);
      console.log(`   Stock: ${sampleProduct.stock_quantity}`);
      console.log(`   Status: ${sampleProduct.status}`);
      console.log(`   Batch ID: ${sampleProduct.source?.batch_id}`);

      if (sampleProduct.source?.batch_metadata) {
        console.log(`\n📋 Batch Metadata:`);
        console.log(`   Batch Part: ${sampleProduct.source.batch_metadata.batch_part}/${sampleProduct.source.batch_metadata.batch_total_parts}`);
        console.log(`   Total Items: ${sampleProduct.source.batch_metadata.batch_total_items}`);
      }
    }

    // Check batch parts distribution
    const batchParts = await PIMProductModel.aggregate([
      { $match: { "source.batch_id": batch_id } },
      {
        $group: {
          _id: "$source.batch_metadata.batch_part",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    if (batchParts.length > 0) {
      console.log(`\n📊 Batch Parts Distribution:`);
      batchParts.forEach((part) => {
        console.log(`   Part ${part._id}: ${part.count} products`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyBatch();
