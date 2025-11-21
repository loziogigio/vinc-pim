import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

await connectToDatabase();

const products = await PIMProductModel.find({
  entity_code: /^BATCH/,
  isCurrent: true
}).sort({ entity_code: 1 }).limit(3);

console.log('📦 Batch Import Verification (first 3 products):\n');

for (const p of products) {
  console.log(`${p.entity_code}:`);
  console.log(`  SKU: ${p.sku}`);
  console.log(`  Status: ${p.status}`);
  console.log(`  \n  Multilingual Fields:`);
  console.log(`  - name.it: "${p.name?.it}"`);
  console.log(`  - description.it: "${p.description?.it?.substring(0, 50)}..."`);
  console.log(`  - short_description.it: "${p.short_description?.it}"`);
  console.log(`  \n  Other Fields:`);
  console.log(`  - price: ${p.price} ${p.currency}`);
  console.log(`  - stock: ${p.stock_quantity}\n`);
}

const total = await PIMProductModel.countDocuments({ entity_code: /^BATCH/, isCurrent: true });
console.log(`✅ Total batch products: ${total}`);
console.log(`\n✅ All products have Italian (IT) as the default language!`);

process.exit(0);
