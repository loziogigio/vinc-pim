/**
 * Example: Basic 10-Product Import
 *
 * This example demonstrates a simple batch import of 10 products
 * with automatic language conversion and Solr synchronization.
 *
 * Usage: npx tsx scripts/examples/basic-import.ts
 */

import { connectToDatabase } from "../../src/lib/db/connection";
import { ImportSourceModel } from "../../src/lib/db/models/import-source";
import { PIMProductModel } from "../../src/lib/db/models/pim-product";
import { projectConfig } from "../../src/config/project.config";
import { SolrAdapter } from "../../src/lib/adapters/solr-adapter";

const products = [
  {
    entity_code: "EXAMPLE-001",
    sku: "EX-SCR-001",
    name: "Cacciavite Professionale",
    description: "Cacciavite di alta qualità con impugnatura ergonomica",
    short_description: "Cacciavite professionale",
    price: 15.99,
    currency: "EUR",
    stock_quantity: 100
  },
  {
    entity_code: "EXAMPLE-002",
    sku: "EX-HAM-001",
    name: "Martello da Carpentiere",
    description: "Martello robusto con manico in legno resistente",
    short_description: "Martello professionale",
    price: 24.50,
    currency: "EUR",
    stock_quantity: 75
  },
  {
    entity_code: "EXAMPLE-003",
    sku: "EX-WRE-001",
    name: "Set Chiavi Inglesi",
    description: "Set completo di 5 chiavi inglesi di diverse dimensioni",
    short_description: "Set 5 chiavi",
    price: 45.00,
    currency: "EUR",
    stock_quantity: 50
  },
  {
    entity_code: "EXAMPLE-004",
    sku: "EX-DRI-001",
    name: "Trapano Elettrico 800W",
    description: "Trapano elettrico potente con velocità variabile",
    short_description: "Trapano 800W",
    price: 89.99,
    currency: "EUR",
    stock_quantity: 30
  },
  {
    entity_code: "EXAMPLE-005",
    sku: "EX-SAW-001",
    name: "Sega Circolare Portatile",
    description: "Sega circolare compatta con lama da 185mm",
    short_description: "Sega circolare",
    price: 129.00,
    currency: "EUR",
    stock_quantity: 20
  },
  {
    entity_code: "EXAMPLE-006",
    sku: "EX-LEV-001",
    name: "Livella Laser Autolivellante",
    description: "Livella laser di precisione con autolivellamento",
    short_description: "Livella laser",
    price: 79.99,
    currency: "EUR",
    stock_quantity: 40
  },
  {
    entity_code: "EXAMPLE-007",
    sku: "EX-TAP-001",
    name: "Metro a Nastro 10m",
    description: "Metro a nastro robusto da 10 metri",
    short_description: "Metro 10m",
    price: 18.50,
    currency: "EUR",
    stock_quantity: 120
  },
  {
    entity_code: "EXAMPLE-008",
    sku: "EX-BOX-001",
    name: "Valigetta Porta Attrezzi",
    description: "Valigetta organizer professionale con scomparti regolabili",
    short_description: "Valigetta attrezzi",
    price: 35.00,
    currency: "EUR",
    stock_quantity: 60
  },
  {
    entity_code: "EXAMPLE-009",
    sku: "EX-GLO-001",
    name: "Guanti da Lavoro Rinforzati",
    description: "Guanti da lavoro con rinforzi in pelle",
    short_description: "Guanti rinforzati",
    price: 12.99,
    currency: "EUR",
    stock_quantity: 200
  },
  {
    entity_code: "EXAMPLE-010",
    sku: "EX-GOG-001",
    name: "Occhiali di Protezione",
    description: "Occhiali di sicurezza con lenti antigraffio",
    short_description: "Occhiali protezione",
    price: 8.99,
    currency: "EUR",
    stock_quantity: 150
  },
];

/**
 * Apply default language to multilingual fields
 */
function applyDefaultLanguage(data: any): void {
  const defaultLang = projectConfig().defaultLanguage;
  const MULTILINGUAL_FIELDS = [
    "name",
    "description",
    "short_description",
    "features",
    "specifications"
  ];

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] && typeof data[field] === "string") {
      data[field] = { [defaultLang]: data[field] };
    }
  }
}

async function importProducts() {
  try {
    console.log("📦 Basic Product Import Example\n");
    await connectToDatabase();

    // Get import source
    const source = await ImportSourceModel.findOne({
      source_id: "test-default-lang"
    });

    if (!source) {
      throw new Error("Import source not found. Please create one first.");
    }

    console.log(`✅ Using source: ${source.source_name}\n`);

    // Initialize Solr adapter
    console.log("🔍 Initializing Search Engine adapter...");
    const solrAdapter = new SolrAdapter({
      enabled: true,
      custom_config: {
        solr_url: process.env.SOLR_URL || "http://localhost:8983/solr",
        solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE || "mycore",
      },
    });
    await solrAdapter.initialize();
    console.log("✅ Search Engine adapter initialized\n");

    let successCount = 0;
    let syncedCount = 0;
    let failedCount = 0;

    for (const productData of products) {
      try {
        // Convert to multilingual format
        applyDefaultLanguage(productData);

        // Delete existing product with same entity_code
        await PIMProductModel.deleteMany({
          entity_code: productData.entity_code
        });

        // Create product
        const createdProduct = await PIMProductModel.create({
          entity_code: productData.entity_code,
          sku: productData.sku,
          version: 1,
          isCurrent: true,
          isCurrentPublished: true,
          status: "published",
          published_at: new Date(),
          image: {
            id: `placeholder-${productData.entity_code}`,
            thumbnail: '/images/placeholder-product.jpg',
            original: '/images/placeholder-product.jpg',
          },
          source: {
            source_id: source.source_id,
            source_name: source.source_name,
            imported_at: new Date(),
          },
          completeness_score: 100,
          auto_publish_eligible: true,
          analytics: {
            views_30d: 0,
            clicks_30d: 0,
            add_to_cart_30d: 0,
            conversions_30d: 0,
            priority_score: 0,
          },
          ...productData,
        });

        console.log(`✅ ${productData.entity_code}: ${productData.name[projectConfig().defaultLanguage]}`);
        successCount++;

        // Sync to Solr
        try {
          const syncResult = await solrAdapter.syncProduct(
            createdProduct.toObject()
          );

          if (syncResult.success) {
            await PIMProductModel.updateOne(
              { _id: createdProduct._id },
              { $set: { "analytics.last_synced_at": new Date() } }
            );
            console.log(`   🔍 Synced to Search Engine`);
            syncedCount++;
          } else {
            console.log(`   ⚠️  Sync failed: ${syncResult.message}`);
          }
        } catch (syncError: any) {
          console.log(`   ⚠️  Sync error: ${syncError.message}`);
        }
      } catch (error: any) {
        console.error(`❌ ${productData.entity_code}: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   MongoDB created: ${successCount}`);
    console.log(`   Search Engine synced: ${syncedCount}`);
    console.log(`   Failed: ${failedCount}`);

    console.log(`\n✅ Import complete!`);
    console.log(`📝 All products have ${projectConfig().defaultLanguage.toUpperCase()} as default language`);
    console.log(`🔍 ${syncedCount} of ${successCount} products synced to Search Engine`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

importProducts();
