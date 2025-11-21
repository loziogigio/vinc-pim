import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function verify() {
  await connectToDatabase();

  const count = await PIMProductModel.countDocuments({
    sku: /^TEST-BATCH-/,
    isCurrent: true
  });

  console.log(`✅ Found ${count} test products in MongoDB\n`);

  const sample = await PIMProductModel.findOne({
    sku: 'TEST-BATCH-0001',
    isCurrent: true
  }).lean();

  if (sample) {
    console.log(`📦 Sample product (TEST-BATCH-0001):`);
    console.log(`   Entity Code: ${sample.entity_code}`);
    console.log(`   Name (IT): ${sample.name?.it}`);
    console.log(`   Name (EN): ${sample.name?.en}`);
    console.log(`   Price: €${sample.price}`);
    console.log(`   Status: ${sample.status}`);
    console.log(`   Version: ${sample.version}`);
    console.log(`   Completeness Score: ${sample.completeness_score}%`);
    console.log(`   Auto-Publish Eligible: ${sample.auto_publish_eligible}`);
  }

  process.exit(0);
}

verify();
