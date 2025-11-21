/**
 * Batch Product Update CLI
 * Command-line tool for bulk product operations
 */

import { connectDB } from "../lib/db/connection";
import { ProductModel } from "../lib/db/models/product";
import { getEnabledLanguages, getAllLanguages } from "../services/language.service";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { projectConfig } from "../config/project.config";

// ============================================================================
// CLI Configuration
// ============================================================================

const command = process.argv[2];
const args = process.argv.slice(3);

const COMMANDS = {
  "add-language": "Add translations for a language from JSON file",
  "remove-language": "Remove translations for a language",
  "import": "Import products from JSON file",
  "export": "Export products to JSON file",
  "reindex": "Reindex products to Solr",
  "stats": "Show product and language statistics",
  "help": "Show this help message"
};

// ============================================================================
// Main CLI Handler
// ============================================================================

async function main() {
  try {
    await connectDB();

    switch (command) {
      case "add-language":
        await addLanguageTranslations();
        break;

      case "remove-language":
        await removeLanguageTranslations();
        break;

      case "import":
        await importProducts();
        break;

      case "export":
        await exportProducts();
        break;

      case "reindex":
        await reindexProducts();
        break;

      case "stats":
        await showStats();
        break;

      case "help":
      default:
        showHelp();
        break;
    }

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * Add language translations from JSON file
 */
async function addLanguageTranslations() {
  const languageCode = args[0];
  const filePath = args[1];

  if (!languageCode || !filePath) {
    console.error("Usage: npx ts-node batch-product-update.ts add-language <language-code> <json-file>");
    console.error("Example: npx ts-node batch-product-update.ts add-language fr translations-fr.json");
    process.exit(1);
  }

  // Verify language is enabled
  const enabledLanguages = await getEnabledLanguages();
  const language = enabledLanguages.find(l => l.code === languageCode);

  if (!language) {
    console.error(`\n❌ Language '${languageCode}' is not enabled`);
    console.log("\nEnabled languages:");
    enabledLanguages.forEach(l => console.log(`  - ${l.code} (${l.name})`));
    process.exit(1);
  }

  // Load translations
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const translations = JSON.parse(fileContent);

  if (!Array.isArray(translations)) {
    console.error("\n❌ JSON file must contain an array of translations");
    process.exit(1);
  }

  console.log(`\n📝 Adding ${languageCode} translations to products...`);
  console.log(`   File: ${filePath}`);
  console.log(`   Translations: ${translations.length}`);

  let updated = 0;
  let failed = 0;

  for (const translation of translations) {
    const { sku, name, description, features, seoTitle, seoDescription } = translation;

    if (!sku) {
      console.log(`   ⚠️  Skipping: Missing SKU`);
      failed++;
      continue;
    }

    try {
      const product = await ProductModel.findOne({ sku });

      if (!product) {
        console.log(`   ⚠️  ${sku}: Product not found`);
        failed++;
        continue;
      }

      let fieldsUpdated = [];

      if (name) {
        if (!product.name) product.name = {};
        product.name[languageCode] = name;
        fieldsUpdated.push("name");
      }

      if (description) {
        if (!product.description) product.description = {};
        product.description[languageCode] = description;
        fieldsUpdated.push("description");
      }

      if (features) {
        if (!product.features) product.features = {};
        product.features[languageCode] = features;
        fieldsUpdated.push("features");
      }

      if (seoTitle) {
        if (!product.seoTitle) product.seoTitle = {};
        product.seoTitle[languageCode] = seoTitle;
        fieldsUpdated.push("seoTitle");
      }

      if (seoDescription) {
        if (!product.seoDescription) product.seoDescription = {};
        product.seoDescription[languageCode] = seoDescription;
        fieldsUpdated.push("seoDescription");
      }

      if (fieldsUpdated.length > 0) {
        await product.save();
        console.log(`   ✅ ${sku}: Updated ${fieldsUpdated.join(", ")}`);
        updated++;
      } else {
        console.log(`   ⚠️  ${sku}: No fields to update`);
        failed++;
      }
    } catch (error: any) {
      console.log(`   ❌ ${sku}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);

  // Reindex to Solr
  if (updated > 0) {
    console.log(`\n🔍 Reindexing to Solr...`);
    try {
      await reindexAllProducts();
      console.log(`   ✅ Solr reindex complete`);
    } catch (error: any) {
      console.error(`   ❌ Solr reindex failed: ${error.message}`);
    }
  }
}

/**
 * Remove language translations
 */
async function removeLanguageTranslations() {
  const languageCode = args[0];

  if (!languageCode) {
    console.error("Usage: npx ts-node batch-product-update.ts remove-language <language-code>");
    console.error("Example: npx ts-node batch-product-update.ts remove-language cs");
    process.exit(1);
  }

  if (languageCode === "it") {
    console.error("\n❌ Cannot remove Italian translations - it's the required default language");
    process.exit(1);
  }

  console.log(`\n⚠️  WARNING: This will remove ALL ${languageCode} translations from ALL products`);
  console.log(`   Language: ${languageCode}`);

  // Count products with this language
  const count = await ProductModel.countDocuments({
    [`name.${languageCode}`]: { $exists: true }
  });

  console.log(`   Products affected: ${count}`);
  console.log(`\nType 'yes' to confirm:`);

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question("", async (answer: string) => {
    readline.close();

    if (answer.toLowerCase() !== "yes") {
      console.log("\nCancelled.");
      process.exit(0);
    }

    console.log(`\n🗑️  Removing ${languageCode} translations...`);

    const products = await ProductModel.find({
      [`name.${languageCode}`]: { $exists: true }
    });

    let removed = 0;

    for (const product of products) {
      let fieldsRemoved = [];

      if (product.name && product.name[languageCode]) {
        delete product.name[languageCode];
        fieldsRemoved.push("name");
      }

      if (product.description && product.description[languageCode]) {
        delete product.description[languageCode];
        fieldsRemoved.push("description");
      }

      if (product.features && product.features[languageCode]) {
        delete product.features[languageCode];
        fieldsRemoved.push("features");
      }

      if (product.seoTitle && product.seoTitle[languageCode]) {
        delete product.seoTitle[languageCode];
        fieldsRemoved.push("seoTitle");
      }

      if (product.seoDescription && product.seoDescription[languageCode]) {
        delete product.seoDescription[languageCode];
        fieldsRemoved.push("seoDescription");
      }

      if (fieldsRemoved.length > 0) {
        await product.save();
        console.log(`   ✅ ${product.sku}: Removed ${fieldsRemoved.join(", ")}`);
        removed++;
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`   Removed: ${removed}`);

    // Reindex to Solr
    if (removed > 0) {
      console.log(`\n🔍 Reindexing to Solr...`);
      try {
        await reindexAllProducts();
        console.log(`   ✅ Solr reindex complete`);
      } catch (error: any) {
        console.error(`   ❌ Solr reindex failed: ${error.message}`);
      }
    }

    process.exit(0);
  });
}

/**
 * Import products from JSON file
 */
async function importProducts() {
  const filePath = args[0];
  const updateExisting = args[1] === "--update";

  if (!filePath) {
    console.error("Usage: npx ts-node batch-product-update.ts import <json-file> [--update]");
    console.error("Example: npx ts-node batch-product-update.ts import products.json --update");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const products = JSON.parse(fileContent);

  if (!Array.isArray(products)) {
    console.error("\n❌ JSON file must contain an array of products");
    process.exit(1);
  }

  console.log(`\n📦 Importing products...`);
  console.log(`   File: ${filePath}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Update existing: ${updateExisting ? "Yes" : "No"}`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const productData of products) {
    const { sku } = productData;

    if (!sku) {
      console.log(`   ⚠️  Skipping: Missing SKU`);
      failed++;
      continue;
    }

    try {
      const existing = await ProductModel.findOne({ sku });

      if (existing) {
        if (updateExisting) {
          Object.assign(existing, productData);
          await existing.save();
          console.log(`   ✅ ${sku}: Updated`);
          updated++;
        } else {
          console.log(`   ⚠️  ${sku}: Already exists (use --update to update)`);
          failed++;
        }
      } else {
        const newProduct = new ProductModel(productData);
        await newProduct.save();
        console.log(`   ✅ ${sku}: Created`);
        created++;
      }
    } catch (error: any) {
      console.log(`   ❌ ${sku}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);

  // Reindex to Solr
  if (created > 0 || updated > 0) {
    console.log(`\n🔍 Reindexing to Solr...`);
    try {
      await reindexAllProducts();
      console.log(`   ✅ Solr reindex complete`);
    } catch (error: any) {
      console.error(`   ❌ Solr reindex failed: ${error.message}`);
    }
  }
}

/**
 * Export products to JSON file
 */
async function exportProducts() {
  const outputFile = args[0] || "products-export.json";
  const languageCode = args[1];

  console.log(`\n📤 Exporting products...`);

  const products = await ProductModel.find({ isPublished: true }).lean();

  console.log(`   Products: ${products.length}`);
  console.log(`   Output: ${outputFile}`);

  // If language specified, create translation-ready format
  if (languageCode) {
    console.log(`   Language: ${languageCode}`);

    const translations = products.map(p => ({
      sku: p.sku,
      name: "",
      description: "",
      features: [],
      seoTitle: "",
      seoDescription: ""
    }));

    fs.writeFileSync(outputFile, JSON.stringify(translations, null, 2));
  } else {
    fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));
  }

  console.log(`\n✅ Export complete!`);
  console.log(`   File: ${outputFile}`);
}

/**
 * Reindex products to Solr
 */
async function reindexProducts() {
  console.log(`\n🔍 Reindexing products to Solr...`);

  await reindexAllProducts();

  console.log(`\n✅ Reindex complete!`);
}

/**
 * Show statistics
 */
async function showStats() {
  console.log(`\n📊 Product & Language Statistics`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Product stats
  const [total, published, draft, archived] = await Promise.all([
    ProductModel.countDocuments(),
    ProductModel.countDocuments({ isPublished: true }),
    ProductModel.countDocuments({ status: "draft" }),
    ProductModel.countDocuments({ status: "archived" })
  ]);

  console.log(`📦 Products:`);
  console.log(`   Total: ${total}`);
  console.log(`   Published: ${published}`);
  console.log(`   Draft: ${draft}`);
  console.log(`   Archived: ${archived}\n`);

  // Language stats
  const enabledLanguages = await getEnabledLanguages();
  const allLanguages = await getAllLanguages();

  console.log(`🌍 Languages:`);
  console.log(`   Total: ${allLanguages.length}`);
  console.log(`   Enabled: ${enabledLanguages.length}`);
  console.log(`   Disabled: ${allLanguages.length - enabledLanguages.length}\n`);

  // Language coverage
  console.log(`📈 Translation Coverage:\n`);

  for (const lang of enabledLanguages) {
    const withName = await ProductModel.countDocuments({
      [`name.${lang.code}`]: { $exists: true }
    });

    const withDescription = await ProductModel.countDocuments({
      [`description.${lang.code}`]: { $exists: true }
    });

    const percentage = total > 0 ? Math.round((withName / total) * 100) : 0;
    const bar = "█".repeat(Math.floor(percentage / 5)) + "░".repeat(20 - Math.floor(percentage / 5));

    console.log(`   ${lang.code.toUpperCase()} ${lang.name}`);
    console.log(`   ${bar} ${percentage}%`);
    console.log(`   Name: ${withName}/${total} | Description: ${withDescription}/${total}\n`);
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(`\n📚 Batch Product Update CLI`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log(`Commands:\n`);

  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`   ${cmd.padEnd(20)} ${desc}`);
  }

  console.log(`\nExamples:\n`);
  console.log(`   # Add French translations`);
  console.log(`   npx ts-node batch-product-update.ts add-language fr translations-fr.json\n`);

  console.log(`   # Import products`);
  console.log(`   npx ts-node batch-product-update.ts import products.json --update\n`);

  console.log(`   # Export products`);
  console.log(`   npx ts-node batch-product-update.ts export products-export.json\n`);

  console.log(`   # Show statistics`);
  console.log(`   npx ts-node batch-product-update.ts stats\n`);

  console.log(`   # Reindex to Solr`);
  console.log(`   npx ts-node batch-product-update.ts reindex\n`);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function reindexAllProducts(): Promise<void> {
  const products = await ProductModel.find({ isPublished: true }).lean();
  const enabledLanguages = await getEnabledLanguages();

  const solrDocuments = products.map(product => {
    const doc: any = {
      id: product.sku,
      sku: product.sku,
      category_name: product.category?.name,
      brand_name: product.brand?.name,
      price: product.price,
      stock_status: product.stock?.status,
      quantity: product.stock?.quantity,
      is_published: product.isPublished,
      is_featured: product.isFeatured
    };

    for (const lang of enabledLanguages) {
      const code = lang.code;

      if (product.name && product.name[code]) {
        doc[`name_text_${code}`] = product.name[code];
      }

      if (product.description && product.description[code]) {
        doc[`description_text_${code}`] = product.description[code];
      }

      if (product.features && product.features[code]) {
        doc[`features_text_${code}`] = product.features[code];
      }
    }

    return doc;
  });

  const solrUrl = `http://${process.env.SOLR_HOST || "localhost"}:${process.env.SOLR_PORT || 8983}/solr/${projectConfig.solrCore}/update?commit=true`;

  await axios.post(solrUrl, solrDocuments, {
    headers: { "Content-Type": "application/json" }
  });
}

// ============================================================================
// Run CLI
// ============================================================================

main();
