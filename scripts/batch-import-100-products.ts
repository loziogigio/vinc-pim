/**
 * Batch import 100 products in batches of 10
 * Tests default language with complete product data
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { projectConfig } from "../src/config/project.config";

// Product categories
const categories = [
  { code: "tools", name: "Utensili" },
  { code: "power-tools", name: "Elettroutensili" },
  { code: "safety", name: "Sicurezza" },
  { code: "storage", name: "Organizzazione" },
  { code: "measuring", name: "Strumenti di Misura" },
];

// Product brands
const brands = [
  { code: "utensili-pro", name: "Utensili Pro" },
  { code: "powertools", name: "PowerTools" },
  { code: "safetyfirst", name: "SafetyFirst" },
  { code: "storagepro", name: "StoragePro" },
  { code: "misurapro", name: "MisuraPro" },
];

// Product templates
const productTemplates = [
  {
    base_name: "Cacciavite",
    description: "Cacciavite professionale di alta qualità. Impugnatura ergonomica antiscivolo. Punta magnetica per presa sicura. Ideale per lavori professionali e domestici.",
    short_description: "Cacciavite professionale con punta magnetica",
    features: ["Punta magnetica", "Impugnatura ergonomica", "Acciaio temperato", "Professionale"],
    specifications: { materiale: "Acciaio CR-V", lunghezza: "200mm", peso: "150g" },
    price_range: [12, 25],
    category: 0,
    brand: 0,
  },
  {
    base_name: "Martello",
    description: "Martello robusto per carpenteria. Manico in legno di frassino resistente. Testa in acciaio temperato forgiato. Peso perfettamente bilanciato per uso confortevole.",
    short_description: "Martello professionale per carpenteria",
    features: ["Manico in legno", "Testa forgiata", "Peso bilanciato", "Professionale"],
    specifications: { materiale: "Acciaio + Legno", peso: "500g", lunghezza_manico: "320mm" },
    price_range: [18, 35],
    category: 0,
    brand: 0,
  },
  {
    base_name: "Trapano",
    description: "Trapano elettrico potente con velocità variabile. Mandrino autoserrante professionale. Motore brushless ad alta efficienza. Perfetto per legno, metallo e muratura.",
    short_description: "Trapano elettrico professionale",
    features: ["Velocità variabile", "Mandrino autoserrante", "Motore brushless", "Multi-materiale"],
    specifications: { potenza: "800W", velocita: "0-3000 RPM", mandrino: "13mm" },
    price_range: [75, 150],
    category: 1,
    brand: 1,
  },
  {
    base_name: "Sega Circolare",
    description: "Sega circolare compatta per tagli precisi. Lama in carburo di tungsteno. Profondità di taglio regolabile. Sistema di protezione integrato per massima sicurezza.",
    short_description: "Sega circolare portatile",
    features: ["Lama al carburo", "Taglio regolabile", "Sistema protezione", "Compatta"],
    specifications: { potenza: "1200W", lama: "185mm", profondita_taglio: "65mm" },
    price_range: [110, 180],
    category: 1,
    brand: 1,
  },
  {
    base_name: "Livella Laser",
    description: "Livella laser autolivellante di precisione. Linee laser rosse ad alta visibilità. Base magnetica per montaggio versatile. Batterie incluse per uso immediato.",
    short_description: "Livella laser autolivellante",
    features: ["Autolivellante", "Laser rosso", "Base magnetica", "Batterie incluse"],
    specifications: { tipo: "Laser Classe II", portata: "15m", precisione: "±0.3mm/m" },
    price_range: [65, 120],
    category: 4,
    brand: 4,
  },
];

/**
 * Generate 100 complete products
 */
function generateProducts(): any[] {
  const products = [];

  for (let i = 1; i <= 100; i++) {
    const template = productTemplates[i % productTemplates.length];
    const category = categories[template.category];
    const brand = brands[template.brand];

    const price = template.price_range[0] + Math.random() * (template.price_range[1] - template.price_range[0]);
    const hasDiscount = Math.random() > 0.7;
    const sale_price = hasDiscount ? price * 0.85 : undefined;

    const product = {
      entity_code: `FULL-${String(i).padStart(3, '0')}`,
      sku: `FULL-SKU-${String(i).padStart(3, '0')}`,

      // Multilingual fields (NO .it suffix - will auto-convert)
      name: `${template.base_name} Modello ${i}`,
      description: template.description,
      short_description: template.short_description,
      features: template.features.join(", "),
      specifications: JSON.stringify(template.specifications),
      meta_title: `${template.base_name} ${i} - Acquista Online`,
      meta_description: `${template.short_description}. Spedizione gratuita. Garanzia 2 anni.`,
      keywords: `${template.base_name.toLowerCase()}, utensili, professionale`,

      // Pricing
      price: parseFloat(price.toFixed(2)),
      sale_price: sale_price ? parseFloat(sale_price.toFixed(2)) : undefined,
      currency: "EUR",

      // Inventory
      stock_quantity: Math.floor(Math.random() * 200) + 10,
      min_stock_quantity: 5,
      max_stock_quantity: 500,

      // Category & Brand (plain strings for reference)
      category: {
        code: category.code,
        name: category.name,
      },
      brand: {
        code: brand.code,
        tprec_darti: brand.name,
      },

      // Product details
      weight: Math.floor(Math.random() * 5000) + 100,
      weight_unit: "g",
      dimensions: {
        length: Math.floor(Math.random() * 300) + 50,
        width: Math.floor(Math.random() * 200) + 30,
        height: Math.floor(Math.random() * 150) + 20,
        unit: "mm",
      },

      // Packaging (removed - not needed for test)

      // Promotions
      promotions: hasDiscount ? [{
        id: `promo-${i}`,
        name: "Sconto Speciale",
        discount_percentage: 15,
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }] : undefined,

      // Meta
      meta: [
        { key: "manufacturer", value: brand.name },
        { key: "warranty", value: "2 anni" },
        { key: "made_in", value: "EU" },
      ],

      // SEO
      slug: `${template.base_name.toLowerCase().replace(/\s+/g, '-')}-${i}`,
      is_featured: i <= 10, // First 10 are featured
      is_new: i > 90, // Last 10 are new

      // Attributes
      attributes: {
        color: ["Rosso", "Nero", "Grigio"][i % 3],
        material: template.specifications.materiale || "Metal",
        professional_grade: true,
      },
    };

    products.push(product);
  }

  return products;
}

/**
 * Apply default language (same as import worker)
 */
function applyDefaultLanguage(data: any): void {
  const defaultLang = projectConfig.defaultLanguage;
  const MULTILINGUAL_FIELDS = [
    "name", "description", "short_description", "features",
    "specifications", "meta_title", "meta_description", "keywords"
  ];

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] && typeof data[field] === "string") {
      data[field] = { [defaultLang]: data[field] };
    }
  }
}

/**
 * Import products in batches
 */
async function batchImport() {
  try {
    console.log("📦 Batch Import - 100 Products (batches of 10)\n");
    await connectToDatabase();

    // Get source
    const source = await ImportSourceModel.findOne({ source_id: "test-default-lang" });
    if (!source) {
      throw new Error("Import source not found");
    }

    console.log(`✅ Source: ${source.source_name}`);
    console.log(`📋 Generating 100 complete products...\n`);

    const products = generateProducts();
    const BATCH_SIZE = 10;
    const batches = [];

    // Split into batches of 10
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      batches.push(products.slice(i, i + BATCH_SIZE));
    }

    console.log(`✅ Created ${batches.length} batches of ${BATCH_SIZE} products each\n`);

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      console.log(`📦 Processing Batch ${batchIdx + 1}/${batches.length} (${batch.length} products)...`);

      for (const productData of batch) {
        try {
          // Apply default language
          applyDefaultLanguage(productData);

          // Delete existing
          await PIMProductModel.deleteMany({ entity_code: productData.entity_code });

          // Add required image
          const image = {
            id: `img-${productData.entity_code}`,
            thumbnail: `/images/products/${productData.slug}-thumb.jpg`,
            original: `/images/products/${productData.slug}.jpg`,
          };

          // Create product
          await PIMProductModel.create({
            entity_code: productData.entity_code,
            sku: productData.sku,
            version: 1,
            isCurrent: true,
            isCurrentPublished: true,
            status: "published",
            published_at: new Date(),
            image,
            source: {
              source_id: source.source_id,
              source_name: source.source_name,
              imported_at: new Date(),
            },
            completeness_score: 95,
            auto_publish_eligible: true,
            analytics: {
              views_30d: 0,
              clicks_30d: 0,
              add_to_cart_30d: 0,
              conversions_30d: 0,
              priority_score: productData.is_featured ? 100 : 50,
              last_synced_at: new Date(),
            },
            ...productData,
          });

          totalSuccess++;

        } catch (error: any) {
          console.log(`   ❌ ${productData.entity_code}: ${error.message}`);
          totalFailed++;
        }
      }

      console.log(`   ✅ Batch ${batchIdx + 1} complete: ${batch.length} products`);
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 FINAL RESULTS`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Total batches: ${batches.length}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Success: ${totalSuccess}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success rate: ${((totalSuccess / products.length) * 100).toFixed(1)}%`);

    console.log(`\n✅ All products have Italian (IT) as default language`);
    console.log(`📝 Fields with default language: name, description, short_description,`);
    console.log(`   features, specifications, meta_title, meta_description, keywords`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

batchImport();
