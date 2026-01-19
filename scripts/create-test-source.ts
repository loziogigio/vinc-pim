/**
 * Create test import source for default language testing
 *
 * Usage:
 *   npx tsx scripts/create-test-source.ts --tenant hidros-it
 *   npx tsx scripts/create-test-source.ts --tenant dfl-eventi-it
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf("--tenant");

  if (tenantIndex >= 0 && args[tenantIndex + 1]) {
    return { tenant: args[tenantIndex + 1] };
  }

  return {};
}

async function createTestSource() {
  try {
    const { tenant } = parseArgs();
    const tenantDb = tenant ? `vinc-${tenant}` : undefined;

    console.log("📋 Creating test import source");
    if (tenant) {
      console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);
    } else {
      console.log(`⚠️  No --tenant specified, using environment default\n`);
    }

    await connectToDatabase(tenantDb);

    // Check if source already exists
    let source = await ImportSourceModel.findOne({
      source_id: "test-default-lang"
    });

    if (source) {
      console.log("ℹ️  Import source already exists. Updating...");

      // Update existing source
      source.field_mapping = [
        { source_field: "entity_code", pim_field: "entity_code" },
        { source_field: "sku", pim_field: "sku" },
        { source_field: "name", pim_field: "name" }, // No .it suffix - will default to Italian
        { source_field: "description", pim_field: "description" }, // No .it suffix
        { source_field: "short_description", pim_field: "short_description" }, // No .it suffix
        { source_field: "price", pim_field: "price", transform: "parseFloat(value)" },
        { source_field: "currency", pim_field: "currency" },
        { source_field: "stock_quantity", pim_field: "stock_quantity", transform: "parseInt(value)" },
        { source_field: "brand_name", pim_field: "brand.name.it" },
        { source_field: "category_name", pim_field: "category.name.it" },
      ];
      source.auto_publish_enabled = true;
      source.min_score_threshold = 0; // Auto-publish all for testing

      await source.save();
      console.log("✅ Import source updated");
    } else {
      // Create new source
      source = await ImportSourceModel.create({
        source_id: "test-default-lang",
        source_name: "Test Default Language Import",
        source_type: "csv",
        auto_publish_enabled: true,
        min_score_threshold: 0,
        required_fields: ["entity_code", "sku", "name"],
        overwrite_level: "automatic",
        field_mapping: [
          { source_field: "entity_code", pim_field: "entity_code" },
          { source_field: "sku", pim_field: "sku" },
          { source_field: "name", pim_field: "name" }, // No .it suffix - will default to Italian
          { source_field: "description", pim_field: "description" }, // No .it suffix
          { source_field: "short_description", pim_field: "short_description" }, // No .it suffix
          { source_field: "price", pim_field: "price", transform: "parseFloat(value)" },
          { source_field: "currency", pim_field: "currency" },
          { source_field: "stock_quantity", pim_field: "stock_quantity", transform: "parseInt(value)" },
          { source_field: "brand_name", pim_field: "brand.name.it" },
          { source_field: "category_name", pim_field: "category.name.it" },
        ],
        limits: {
          max_batch_size: 1000,
          warn_batch_size: 500,
          chunk_size: 100,
          timeout_minutes: 10,
        },
        stats: {
          total_imports: 0,
          total_products: 0,
          avg_completeness_score: 0,
        },
        created_by: "system",
        is_active: true,
      });
      console.log("✅ Import source created");
    }

    console.log("\n📦 Import Source Details:");
    console.log(`   Source ID: ${source.source_id}`);
    console.log(`   Source Name: ${source.source_name}`);
    console.log(`   Auto-publish: ${source.auto_publish_enabled ? 'Yes' : 'No'}`);
    console.log(`   Field Mappings: ${source.field_mapping.length} fields`);

    console.log("\n📋 Field Mappings:");
    source.field_mapping.forEach((m) => {
      console.log(`   ${m.source_field} → ${m.pim_field}${m.transform ? ` [${m.transform}]` : ''}`);
    });

    console.log("\n✅ Import source ready!");
    console.log("\n📝 Next steps:");
    console.log("   1. Upload test-products.csv via the import API");
    console.log(`   2. Use source_id: ${source.source_id}`);
    console.log("   3. Monitor the import worker to see default language being applied");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createTestSource();
