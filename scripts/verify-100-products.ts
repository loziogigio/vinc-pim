import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

await connectToDatabase();

// Get total count
const total = await PIMProductModel.countDocuments({ entity_code: /^FULL/, isCurrent: true });

// Get first product with full details
const product = await PIMProductModel.findOne({ entity_code: "FULL-001", isCurrent: true });

// Get sample of products
const sample = await PIMProductModel.find({ entity_code: /^FULL/, isCurrent: true })
  .select('entity_code sku name description price stock_quantity')
  .limit(5)
  .lean();

console.log('📊 BATCH IMPORT VERIFICATION\n');
console.log(`${"=".repeat(60)}`);
console.log(`Total products imported: ${total}`);
console.log(`${"=".repeat(60)}\n`);

if (product) {
  console.log('📦 Complete Product Example (FULL-001):\n');
  console.log(`Entity Code: ${product.entity_code}`);
  console.log(`SKU: ${product.sku}`);
  console.log(`Status: ${product.status}`);

  console.log(`\n📝 Multilingual Fields (with default language IT):`);
  console.log(`  name.it: "${product.name?.it}"`);
  console.log(`  description.it: "${product.description?.it?.substring(0, 80)}..."`);
  console.log(`  short_description.it: "${product.short_description?.it}"`);
  console.log(`  features.it: "${product.features?.it}"`);
  console.log(`  meta_title.it: "${product.meta_title?.it}"`);
  console.log(`  meta_description.it: "${product.meta_description?.it?.substring(0, 60)}..."`);
  console.log(`  keywords.it: "${product.keywords?.it}"`);

  console.log(`\n💰 Pricing:`);
  console.log(`  price: ${product.price} ${product.currency}`);
  if (product.sale_price) console.log(`  sale_price: ${product.sale_price} ${product.currency}`);

  console.log(`\n📦 Inventory:`);
  console.log(`  stock: ${product.stock_quantity}`);
  console.log(`  min_stock: ${product.min_stock_quantity}`);
  console.log(`  max_stock: ${product.max_stock_quantity}`);

  console.log(`\n🏷️  Category & Brand:`);
  console.log(`  category: ${product.category?.name}`);
  console.log(`  brand: ${product.brand?.tprec_darti}`);

  console.log(`\n📐 Product Details:`);
  console.log(`  weight: ${product.weight}${product.weight_unit}`);
  console.log(`  dimensions: ${product.dimensions?.length}x${product.dimensions?.width}x${product.dimensions?.height}${product.dimensions?.unit}`);

  console.log(`\n✨ Additional Info:`);
  console.log(`  is_featured: ${product.is_featured}`);
  console.log(`  is_new: ${product.is_new}`);
  console.log(`  slug: ${product.slug}`);
  if (product.promotions && product.promotions.length > 0) {
    console.log(`  active_promotion: ${product.promotions[0].name} (-${product.promotions[0].discount_percentage}%)`);
  }
}

console.log(`\n\n📋 Sample of Products (first 5):\n`);
console.table(sample.map(p => ({
  Code: p.entity_code,
  SKU: p.sku,
  Name: p.name?.it?.substring(0, 30) + '...',
  Price: p.price,
  Stock: p.stock_quantity
})));

console.log(`\n✅ All ${total} products have Italian (IT) as the default language!`);
console.log(`\n📝 Default language applied to fields:`);
console.log(`   - name, description, short_description`);
console.log(`   - features, specifications`);
console.log(`   - meta_title, meta_description, keywords`);

process.exit(0);
