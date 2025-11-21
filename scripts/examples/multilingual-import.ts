/**
 * Example: Multilingual Product Import
 *
 * This example demonstrates importing products with multiple language translations.
 * Products include Italian, English, German, and French translations.
 *
 * Usage: npx tsx scripts/examples/multilingual-import.ts
 */

import { connectToDatabase } from "../../src/lib/db/connection";
import { ImportSourceModel } from "../../src/lib/db/models/import-source";
import { PIMProductModel } from "../../src/lib/db/models/pim-product";
import { SolrAdapter } from "../../src/lib/adapters/solr-adapter";

const multilingualProducts = [
  {
    entity_code: "ML-TOOL-001",
    sku: "ML-SCR-001",
    name: {
      it: "Cacciavite Professionale",
      en: "Professional Screwdriver",
      de: "Professioneller Schraubendreher",
      fr: "Tournevis Professionnel"
    },
    description: {
      it: "Cacciavite di alta qualità con impugnatura ergonomica. Ideale per uso professionale e lavori di precisione.",
      en: "High-quality screwdriver with ergonomic grip. Ideal for professional use and precision work.",
      de: "Hochwertiger Schraubendreher mit ergonomischem Griff. Ideal für den professionellen Einsatz und Präzisionsarbeiten.",
      fr: "Tournevis de haute qualité avec poignée ergonomique. Idéal pour un usage professionnel et travaux de précision."
    },
    short_description: {
      it: "Cacciavite professionale",
      en: "Professional screwdriver",
      de: "Professioneller Schraubendreher",
      fr: "Tournevis professionnel"
    },
    features: {
      it: "Impugnatura ergonomica, Punta magnetica, Manico antiscivolo",
      en: "Ergonomic grip, Magnetic tip, Non-slip handle",
      de: "Ergonomischer Griff, Magnetische Spitze, Rutschfester Griff",
      fr: "Poignée ergonomique, Pointe magnétique, Manche antidérapant"
    },
    meta_title: {
      it: "Cacciavite Professionale - Alta Qualità | Utensili",
      en: "Professional Screwdriver - High Quality | Tools",
      de: "Professioneller Schraubendreher - Hohe Qualität | Werkzeuge",
      fr: "Tournevis Professionnel - Haute Qualité | Outils"
    },
    url_key: {
      it: "cacciavite-professionale",
      en: "professional-screwdriver",
      de: "professioneller-schraubendreher",
      fr: "tournevis-professionnel"
    },
    price: 15.99,
    currency: "EUR",
    stock_quantity: 100
  },
  {
    entity_code: "ML-TOOL-002",
    sku: "ML-HAM-001",
    name: {
      it: "Martello da Carpentiere",
      en: "Carpenter Hammer",
      de: "Zimmermannshammer",
      fr: "Marteau de Charpentier"
    },
    description: {
      it: "Martello robusto con manico in legno resistente. Perfetto per lavori di carpenteria e costruzione.",
      en: "Robust hammer with durable wooden handle. Perfect for carpentry and construction work.",
      de: "Robuster Hammer mit strapazierfähigem Holzgriff. Perfekt für Zimmerei- und Bauarbeiten.",
      fr: "Marteau robuste avec manche en bois durable. Parfait pour les travaux de menuiserie et de construction."
    },
    short_description: {
      it: "Martello professionale",
      en: "Professional hammer",
      de: "Professioneller Hammer",
      fr: "Marteau professionnel"
    },
    features: {
      it: "Manico in legno, Testa in acciaio forgiato, Peso bilanciato",
      en: "Wooden handle, Forged steel head, Balanced weight",
      de: "Holzgriff, Geschmiedeter Stahlkopf, Ausgewogenes Gewicht",
      fr: "Manche en bois, Tête en acier forgé, Poids équilibré"
    },
    price: 24.50,
    currency: "EUR",
    stock_quantity: 75
  },
  {
    entity_code: "ML-SAFE-001",
    sku: "ML-GLO-001",
    name: {
      it: "Guanti da Lavoro Rinforzati",
      en: "Reinforced Work Gloves",
      de: "Verstärkte Arbeitshandschuhe",
      fr: "Gants de Travail Renforcés"
    },
    description: {
      it: "Guanti da lavoro con rinforzi in pelle per protezione extra. Ideali per lavori pesanti.",
      en: "Work gloves with leather reinforcements for extra protection. Ideal for heavy-duty work.",
      de: "Arbeitshandschuhe mit Lederverstärkungen für zusätzlichen Schutz. Ideal für schwere Arbeiten.",
      fr: "Gants de travail avec renforts en cuir pour une protection supplémentaire. Idéaux pour les travaux lourds."
    },
    short_description: {
      it: "Guanti rinforzati",
      en: "Reinforced gloves",
      de: "Verstärkte Handschuhe",
      fr: "Gants renforcés"
    },
    features: {
      it: "Rinforzi in pelle, Traspiranti, Polso elastico",
      en: "Leather reinforcements, Breathable, Elastic wrist",
      de: "Lederverstärkungen, Atmungsaktiv, Elastisches Handgelenk",
      fr: "Renforts en cuir, Respirant, Poignet élastique"
    },
    price: 12.99,
    currency: "EUR",
    stock_quantity: 200
  },
  {
    entity_code: "ML-ELEC-001",
    sku: "ML-DRI-001",
    name: {
      it: "Trapano Elettrico 800W",
      en: "800W Electric Drill",
      de: "800W Elektrobohrer",
      fr: "Perceuse Électrique 800W"
    },
    description: {
      it: "Trapano elettrico potente da 800W con velocità variabile. Include set di punte.",
      en: "Powerful 800W electric drill with variable speed. Includes drill bit set.",
      de: "Leistungsstarker 800W-Elektrobohrer mit variabler Geschwindigkeit. Inklusive Bohrerset.",
      fr: "Perceuse électrique puissante de 800W avec vitesse variable. Comprend un ensemble de mèches."
    },
    short_description: {
      it: "Trapano 800W",
      en: "800W Drill",
      de: "800W Bohrer",
      fr: "Perceuse 800W"
    },
    features: {
      it: "800W di potenza, Velocità variabile, Set punte incluso",
      en: "800W power, Variable speed, Drill bit set included",
      de: "800W Leistung, Variable Geschwindigkeit, Bohrer-Set enthalten",
      fr: "Puissance 800W, Vitesse variable, Ensemble de mèches inclus"
    },
    specifications: {
      it: "Potenza: 800W, Velocità: 0-3000 RPM, Mandrino: 13mm",
      en: "Power: 800W, Speed: 0-3000 RPM, Chuck: 13mm",
      de: "Leistung: 800W, Geschwindigkeit: 0-3000 U/min, Spannfutter: 13mm",
      fr: "Puissance: 800W, Vitesse: 0-3000 tr/min, Mandrin: 13mm"
    },
    price: 89.99,
    currency: "EUR",
    stock_quantity: 30
  },
  {
    entity_code: "ML-SAFE-002",
    sku: "ML-GOG-001",
    name: {
      it: "Occhiali di Protezione",
      en: "Safety Glasses",
      de: "Schutzbrille",
      fr: "Lunettes de Sécurité"
    },
    description: {
      it: "Occhiali di sicurezza con lenti antigraffio e protezione UV. Conformi agli standard CE.",
      en: "Safety glasses with scratch-resistant lenses and UV protection. CE standard compliant.",
      de: "Schutzbrille mit kratzfesten Gläsern und UV-Schutz. CE-Standard konform.",
      fr: "Lunettes de sécurité avec verres résistants aux rayures et protection UV. Conformes aux normes CE."
    },
    short_description: {
      it: "Occhiali protezione",
      en: "Safety glasses",
      de: "Schutzbrille",
      fr: "Lunettes de sécurité"
    },
    features: {
      it: "Lenti antigraffio, Protezione UV, Montatura leggera",
      en: "Scratch-resistant lenses, UV protection, Lightweight frame",
      de: "Kratzfeste Gläser, UV-Schutz, Leichtgewichtiger Rahmen",
      fr: "Verres résistants aux rayures, Protection UV, Monture légère"
    },
    price: 8.99,
    currency: "EUR",
    stock_quantity: 150
  },
];

async function importMultilingualProducts() {
  try {
    console.log("🌍 Multilingual Product Import Example\n");
    await connectToDatabase();

    // Get import source
    const source = await ImportSourceModel.findOne({
      source_id: "test-default-lang"
    });

    if (!source) {
      throw new Error("Import source not found. Please create one first.");
    }

    console.log(`✅ Using source: ${source.source_name}`);
    console.log(`🌍 Languages: Italian, English, German, French\n`);

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

    for (const productData of multilingualProducts) {
      try {
        // Delete existing product with same entity_code
        await PIMProductModel.deleteMany({
          entity_code: productData.entity_code
        });

        // Create product (multilingual data already in correct format)
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

        console.log(`✅ ${productData.entity_code}`);
        console.log(`   IT: ${productData.name.it}`);
        console.log(`   EN: ${productData.name.en}`);
        console.log(`   DE: ${productData.name.de}`);
        console.log(`   FR: ${productData.name.fr}`);
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
            console.log(`   🔍 Synced to Search Engine\n`);
            syncedCount++;
          } else {
            console.log(`   ⚠️  Sync failed: ${syncResult.message}\n`);
          }
        } catch (syncError: any) {
          console.log(`   ⚠️  Sync error: ${syncError.message}\n`);
        }
      } catch (error: any) {
        console.error(`❌ ${productData.entity_code}: ${error.message}\n`);
        failedCount++;
      }
    }

    console.log(`${"=".repeat(60)}`);
    console.log(`📊 Results:`);
    console.log(`   MongoDB created: ${successCount}`);
    console.log(`   Search Engine synced: ${syncedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`${"=".repeat(60)}`);

    console.log(`\n✅ Multilingual import complete!`);
    console.log(`🌍 ${successCount} products with 4 language translations`);
    console.log(`🔍 ${syncedCount} products synced to Search Engine`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

importMultilingualProducts();
