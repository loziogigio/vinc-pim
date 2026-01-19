/**
 * Import products via API in batches
 * Tests default language logic with direct API import
 *
 * Usage:
 *   npx tsx scripts/import-via-api-batch.ts --tenant hidros-it
 *   npx tsx scripts/import-via-api-batch.ts --tenant dfl-eventi-it
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { importQueue } from "../src/lib/queue/queues";

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

// 10 test products with Italian content (no language suffixes)
const products = [
  {
    entity_code: "API-PROD-001",
    sku: "API-SKU-001",
    name: "Cacciavite Professionale",
    description: "Cacciavite di alta qualità con impugnatura ergonomica. Ideale per lavori professionali e domestici.",
    short_description: "Cacciavite professionale con punta magnetica",
    price: 15.99,
    currency: "EUR",
    stock_quantity: 100,
  },
  {
    entity_code: "API-PROD-002",
    sku: "API-SKU-002",
    name: "Martello da Carpentiere",
    description: "Martello robusto con manico in legno resistente. Testa in acciaio temperato per massima durata.",
    short_description: "Martello professionale per carpenteria",
    price: 24.50,
    currency: "EUR",
    stock_quantity: 75,
  },
  {
    entity_code: "API-PROD-003",
    sku: "API-SKU-003",
    name: "Set Chiavi Inglesi",
    description: "Set completo di 5 chiavi inglesi di diverse dimensioni. Finitura cromata antiruggine.",
    short_description: "Set 5 chiavi inglesi cromate",
    price: 45.00,
    currency: "EUR",
    stock_quantity: 50,
  },
  {
    entity_code: "API-PROD-004",
    sku: "API-SKU-004",
    name: "Trapano Elettrico 800W",
    description: "Trapano elettrico potente con velocità variabile. Mandrino autoserrante da 13mm.",
    short_description: "Trapano elettrico 800W professionale",
    price: 89.99,
    currency: "EUR",
    stock_quantity: 30,
  },
  {
    entity_code: "API-PROD-005",
    sku: "API-SKU-005",
    name: "Sega Circolare Portatile",
    description: "Sega circolare compatta con lama da 185mm. Profondità di taglio regolabile.",
    short_description: "Sega circolare portatile professionale",
    price: 129.00,
    currency: "EUR",
    stock_quantity: 20,
  },
  {
    entity_code: "API-PROD-006",
    sku: "API-SKU-006",
    name: "Livella Laser Autolivellante",
    description: "Livella laser di precisione con autolivellamento. Linee laser rosse visibili fino a 15 metri.",
    short_description: "Livella laser professionale autolivellante",
    price: 79.99,
    currency: "EUR",
    stock_quantity: 40,
  },
  {
    entity_code: "API-PROD-007",
    sku: "API-SKU-007",
    name: "Metro a Nastro 10m",
    description: "Metro a nastro robusto da 10 metri. Nastro resistente con rivestimento protettivo.",
    short_description: "Metro a nastro professionale 10m",
    price: 18.50,
    currency: "EUR",
    stock_quantity: 120,
  },
  {
    entity_code: "API-PROD-008",
    sku: "API-SKU-008",
    name: "Valigetta Porta Attrezzi",
    description: "Valigetta organizer professionale con scomparti regolabili. Materiale resistente agli urti.",
    short_description: "Valigetta porta attrezzi professionale",
    price: 35.00,
    currency: "EUR",
    stock_quantity: 60,
  },
  {
    entity_code: "API-PROD-009",
    sku: "API-SKU-009",
    name: "Guanti da Lavoro Rinforzati",
    description: "Guanti da lavoro con rinforzi in pelle. Protezione palmo e dita. Traspiranti e confortevoli.",
    short_description: "Guanti lavoro rinforzati professionali",
    price: 12.99,
    currency: "EUR",
    stock_quantity: 200,
  },
  {
    entity_code: "API-PROD-010",
    sku: "API-SKU-010",
    name: "Occhiali di Protezione",
    description: "Occhiali di sicurezza con lenti antigraffio e anti-appannamento. Protezione UV completa.",
    short_description: "Occhiali protezione professionali",
    price: 8.99,
    currency: "EUR",
    stock_quantity: 150,
  },
];

async function importViaAPI() {
  try {
    const { tenant } = parseArgs();
    const tenantDb = tenant ? `vinc-${tenant}` : undefined;

    console.log("📦 Importing 10 products via API (batch mode)");
    if (tenant) {
      console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);
    } else {
      console.log(`⚠️  No --tenant specified, using environment default\n`);
    }

    await connectToDatabase(tenantDb);

    // Get or create API import source
    let source = await ImportSourceModel.findOne({ source_id: "api-batch-import" });

    if (!source) {
      source = await ImportSourceModel.create({
        source_id: "api-batch-import",
        source_name: "API Batch Import",
        source_type: "api",
        auto_publish_enabled: true,
        min_score_threshold: 0,
        required_fields: ["entity_code", "sku", "name"],
        overwrite_level: "automatic",
        field_mapping: [], // Not needed for API import
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
      console.log("✅ Created API import source");
    }

    // Create import job with API data
    const job_id = `import_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`📋 Creating import job: ${job_id}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Source: ${source.source_id}\n`);

    // Queue the import job
    await importQueue.add("process-import", {
      job_id,
      source_id: source.source_id,
      // API import data (simulating API response)
      api_config: {
        endpoint: "internal",
        method: "GET",
      },
      // Pass products directly (worker will handle this)
      products,
    });

    console.log("✅ Import job queued successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. The import worker will process the job");
    console.log("   2. Check logs to see default language being applied");
    console.log("   3. Verify products: npx tsx scripts/check-test-products.ts");
    console.log("\n💡 Note: Field 'name', 'description', 'short_description' have NO .it suffix");
    console.log("   The parser will automatically convert them to { it: '...' }");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

importViaAPI();
