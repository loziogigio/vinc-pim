/**
 * Fix import source field mappings
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";

await connectToDatabase();

const source = await ImportSourceModel.findOne({ source_id: "test-default-lang" });

if (!source) {
  console.error("❌ Source not found");
  process.exit(1);
}

// Fix field mappings - brand and category names should be plain strings
source.field_mapping = [
  { source_field: "entity_code", pim_field: "entity_code" },
  { source_field: "sku", pim_field: "sku" },
  { source_field: "name", pim_field: "name" }, // Will default to IT
  { source_field: "description", pim_field: "description" }, // Will default to IT
  { source_field: "short_description", pim_field: "short_description" }, // Will default to IT
  { source_field: "price", pim_field: "price", transform: "parseFloat(value)" },
  { source_field: "currency", pim_field: "currency" },
  { source_field: "stock_quantity", pim_field: "stock_quantity", transform: "parseInt(value)" },
  { source_field: "brand_name", pim_field: "brand.tprec_darti" }, // Plain string field for brand name
  { source_field: "category_name", pim_field: "category.name" }, // Plain string field for category name
];

await source.save();

console.log("✅ Import source updated");
console.log("\n📋 New field mappings:");
source.field_mapping.forEach(m => {
  console.log(`   ${m.source_field} → ${m.pim_field}${m.transform ? ` [${m.transform}]` : ''}`);
});

process.exit(0);
