/**
 * Setup Solr Schema via API
 * Creates complete multilingual schema using Solr Schema API
 *
 * Usage: npx ts-node src/scripts/setup-solr-schema.ts
 */

import axios from "axios";
import { projectConfig } from "../config/project.config";

const SOLR_HOST = process.env.SOLR_HOST || "localhost";
const SOLR_PORT = process.env.SOLR_PORT || "8983";
const SOLR_CORE = projectConfig.solrCore;
const SOLR_BASE_URL = `http://${SOLR_HOST}:${SOLR_PORT}/solr/${SOLR_CORE}`;

interface FieldTypeDefinition {
  name: string;
  class: string;
  [key: string]: any;
}

interface FieldDefinition {
  name: string;
  type: string;
  indexed?: boolean;
  stored?: boolean;
  required?: boolean;
  multiValued?: boolean;
  [key: string]: any;
}

/**
 * Check if Solr core exists
 */
async function checkSolrCore(): Promise<boolean> {
  try {
    const response = await axios.get(`http://${SOLR_HOST}:${SOLR_PORT}/solr/admin/cores?action=STATUS&core=${SOLR_CORE}`);
    return response.data.status[SOLR_CORE] !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Add field type to Solr schema
 */
async function addFieldType(fieldType: FieldTypeDefinition): Promise<void> {
  try {
    await axios.post(`${SOLR_BASE_URL}/schema`, {
      "add-field-type": fieldType
    });
    console.log(`  ✅ Added field type: ${fieldType.name}`);
  } catch (error: any) {
    if (error.response?.data?.error?.msg?.includes("already exists")) {
      console.log(`  ✓ Field type '${fieldType.name}' already exists`);
    } else {
      console.error(`  ❌ Failed to add field type '${fieldType.name}':`, error.response?.data || error.message);
    }
  }
}

/**
 * Add field to Solr schema
 */
async function addField(field: FieldDefinition): Promise<void> {
  try {
    await axios.post(`${SOLR_BASE_URL}/schema`, {
      "add-field": field
    });
    console.log(`  ✅ Added field: ${field.name}`);
  } catch (error: any) {
    if (error.response?.data?.error?.msg?.includes("already exists")) {
      console.log(`  ✓ Field '${field.name}' already exists`);
    } else {
      console.error(`  ❌ Failed to add field '${field.name}':`, error.response?.data || error.message);
    }
  }
}

/**
 * Add dynamic field to Solr schema
 */
async function addDynamicField(field: FieldDefinition): Promise<void> {
  try {
    await axios.post(`${SOLR_BASE_URL}/schema`, {
      "add-dynamic-field": field
    });
    console.log(`  ✅ Added dynamic field: ${field.name}`);
  } catch (error: any) {
    if (error.response?.data?.error?.msg?.includes("already exists")) {
      console.log(`  ✓ Dynamic field '${field.name}' already exists`);
    } else {
      console.error(`  ❌ Failed to add dynamic field '${field.name}':`, error.response?.data || error.message);
    }
  }
}

/**
 * Add copy field rule
 */
async function addCopyField(source: string, dest: string): Promise<void> {
  try {
    await axios.post(`${SOLR_BASE_URL}/schema`, {
      "add-copy-field": {
        source,
        dest
      }
    });
    console.log(`  ✅ Added copy field: ${source} → ${dest}`);
  } catch (error: any) {
    if (error.response?.data?.error?.msg?.includes("already exists")) {
      console.log(`  ✓ Copy field '${source} → ${dest}' already exists`);
    } else {
      console.error(`  ❌ Failed to add copy field:`, error.response?.data || error.message);
    }
  }
}

/**
 * Define language-specific field types
 */
function getLanguageFieldTypes(): FieldTypeDefinition[] {
  return [
    // Italian
    {
      name: "text_it",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.ElisionFilterFactory", ignoreCase: true, articles: "lang/contractions_it.txt" },
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_it.txt" },
          { class: "solr.ItalianLightStemFilterFactory" }
        ]
      }
    },

    // German
    {
      name: "text_de",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_de.txt", format: "snowball" },
          { class: "solr.GermanNormalizationFilterFactory" },
          { class: "solr.GermanLightStemFilterFactory" }
        ]
      }
    },

    // English
    {
      name: "text_en",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_en.txt" },
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.EnglishPossessiveFilterFactory" },
          { class: "solr.PorterStemFilterFactory" }
        ]
      }
    },

    // Czech
    {
      name: "text_cs",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_cs.txt" }
        ]
      }
    },

    // French
    {
      name: "text_fr",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.ElisionFilterFactory", ignoreCase: true, articles: "lang/contractions_fr.txt" },
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_fr.txt", format: "snowball" },
          { class: "solr.FrenchLightStemFilterFactory" }
        ]
      }
    },

    // Spanish
    {
      name: "text_es",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_es.txt", format: "snowball" },
          { class: "solr.SpanishLightStemFilterFactory" }
        ]
      }
    },

    // Russian
    {
      name: "text_ru",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_ru.txt", format: "snowball" },
          { class: "solr.RussianLightStemFilterFactory" }
        ]
      }
    },

    // Arabic
    {
      name: "text_ar",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_ar.txt" },
          { class: "solr.ArabicNormalizationFilterFactory" },
          { class: "solr.ArabicStemFilterFactory" }
        ]
      }
    },

    // Japanese
    {
      name: "text_ja",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.JapaneseTokenizerFactory", mode: "search" },
        filters: [
          { class: "solr.JapaneseBaseFormFilterFactory" },
          { class: "solr.JapanesePartOfSpeechStopFilterFactory" },
          { class: "solr.CJKWidthFilterFactory" },
          { class: "solr.StopFilterFactory", ignoreCase: true, words: "lang/stopwords_ja.txt" },
          { class: "solr.LowerCaseFilterFactory" }
        ]
      }
    },

    // CJK (Chinese/Korean)
    {
      name: "text_cjk",
      class: "solr.TextField",
      positionIncrementGap: 100,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.CJKWidthFilterFactory" },
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.CJKBigramFilterFactory" }
        ]
      }
    },

    // General text (fallback)
    {
      name: "text_general",
      class: "solr.TextField",
      positionIncrementGap: 100,
      multiValued: true,
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" }
        ]
      }
    }
  ];
}

/**
 * Define core product fields
 */
function getCoreFields(): FieldDefinition[] {
  return [
    // Unique identifiers
    { name: "id", type: "string", indexed: true, stored: true, required: true },
    { name: "sku", type: "string", indexed: true, stored: true, required: true },
    { name: "entity_code", type: "string", indexed: true, stored: true },

    // Versioning & Status
    { name: "version", type: "pint", indexed: true, stored: true },
    { name: "isCurrent", type: "boolean", indexed: true, stored: true },
    { name: "isCurrentPublished", type: "boolean", indexed: true, stored: true },
    { name: "status", type: "string", indexed: true, stored: true },
    { name: "product_status", type: "string", indexed: true, stored: true },

    // Dates
    { name: "created_at", type: "pdate", indexed: true, stored: true },
    { name: "updated_at", type: "pdate", indexed: true, stored: true },
    { name: "published_at", type: "pdate", indexed: true, stored: true },

    // Category & Taxonomy
    { name: "category_id", type: "string", indexed: true, stored: true },
    { name: "category_name", type: "string", indexed: true, stored: true },
    { name: "category_slug", type: "string", indexed: true, stored: true },
    { name: "category_name_text", type: "text_general", indexed: true, stored: false },

    { name: "collection_ids", type: "string", indexed: true, stored: true, multiValued: true },
    { name: "collection_names", type: "string", indexed: true, stored: true, multiValued: true },
    { name: "collection_slugs", type: "string", indexed: true, stored: true, multiValued: true },

    { name: "brand_id", type: "string", indexed: true, stored: true },
    { name: "brand_name", type: "string", indexed: true, stored: true },
    { name: "brand_slug", type: "string", indexed: true, stored: true },
    { name: "brand_name_text", type: "text_general", indexed: true, stored: false },

    { name: "tag_names", type: "string", indexed: true, stored: true, multiValued: true },
    { name: "tag_slugs", type: "string", indexed: true, stored: true, multiValued: true },

    { name: "product_type_id", type: "string", indexed: true, stored: true },
    { name: "product_type_name", type: "string", indexed: true, stored: true },
    { name: "product_type_slug", type: "string", indexed: true, stored: true },

    // Inventory & Pricing
    { name: "price", type: "pfloat", indexed: true, stored: true },
    { name: "quantity", type: "pint", indexed: true, stored: true },
    { name: "stock_status", type: "string", indexed: true, stored: true },
    { name: "sold", type: "pint", indexed: true, stored: true },
    { name: "unit", type: "string", indexed: true, stored: true },

    // Specifications
    { name: "specifications_json", type: "string", indexed: false, stored: true },
    { name: "spec_power", type: "pfloat", indexed: true, stored: true },
    { name: "spec_weight", type: "pfloat", indexed: true, stored: true },
    { name: "spec_voltage", type: "pint", indexed: true, stored: true },

    // Analytics & Ranking
    { name: "completeness_score", type: "pint", indexed: true, stored: true },
    { name: "views_30d", type: "pint", indexed: true, stored: true },
    { name: "clicks_30d", type: "pint", indexed: true, stored: true },
    { name: "add_to_cart_30d", type: "pint", indexed: true, stored: true },
    { name: "conversions_30d", type: "pint", indexed: true, stored: true },
    { name: "priority_score", type: "pint", indexed: true, stored: true },

    // Promotions
    { name: "promo_codes", type: "string", indexed: true, stored: true, multiValued: true },
    { name: "has_active_promo", type: "boolean", indexed: true, stored: true },
    { name: "promo_types", type: "string", indexed: true, stored: true, multiValued: true },
    { name: "max_discount_pct", type: "pfloat", indexed: true, stored: true },

    // Media & Gallery
    { name: "has_video", type: "boolean", indexed: true, stored: true },
    { name: "has_3d_model", type: "boolean", indexed: true, stored: true },
    { name: "image_count", type: "pint", indexed: true, stored: true },
    { name: "cover_image_url", type: "string", indexed: false, stored: true },

    // Variations
    { name: "is_parent", type: "boolean", indexed: true, stored: true },
    { name: "parent_sku", type: "string", indexed: true, stored: true },
    { name: "variation_count", type: "pint", indexed: true, stored: true },
  ];
}

/**
 * Define multilingual fields for default languages
 */
function getMultilingualFields(): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  const languages = ['it', 'de', 'en', 'cs'];
  const fieldNames = ['name', 'description', 'short_description', 'seo_title', 'seo_description'];
  const multiValuedFields = ['features', 'seo_keywords'];

  for (const lang of languages) {
    const langType = `text_${lang}`;

    // Regular fields
    for (const fieldName of fieldNames) {
      fields.push({
        name: `${fieldName}_${langType}`,
        type: langType,
        indexed: true,
        stored: true
      });
    }

    // Multi-valued fields
    for (const fieldName of multiValuedFields) {
      fields.push({
        name: `${fieldName}_${langType}`,
        type: langType,
        indexed: true,
        stored: true,
        multiValued: true
      });
    }
  }

  return fields;
}

/**
 * Define dynamic fields for additional languages
 */
function getDynamicFields(): FieldDefinition[] {
  return [
    { name: "*_text_fr", type: "text_fr", indexed: true, stored: true },
    { name: "*_text_es", type: "text_es", indexed: true, stored: true },
    { name: "*_text_ru", type: "text_ru", indexed: true, stored: true },
    { name: "*_text_ar", type: "text_ar", indexed: true, stored: true },
    { name: "*_text_ja", type: "text_ja", indexed: true, stored: true },
    { name: "*_text_cjk", type: "text_cjk", indexed: true, stored: true },

    // Generic dynamic fields
    { name: "*_s", type: "string", indexed: true, stored: true },
    { name: "*_ss", type: "string", indexed: true, stored: true, multiValued: true },
    { name: "*_i", type: "pint", indexed: true, stored: true },
    { name: "*_f", type: "pfloat", indexed: true, stored: true },
    { name: "*_b", type: "boolean", indexed: true, stored: true },
    { name: "*_dt", type: "pdate", indexed: true, stored: true },
    { name: "*_t", type: "text_general", indexed: true, stored: true },
  ];
}

/**
 * Define copy field rules
 */
function getCopyFieldRules(): Array<{ source: string; dest: string }> {
  return [
    // Copy all multilingual text to _text_ for general search
    { source: "name_text_*", dest: "_text_" },
    { source: "description_text_*", dest: "_text_" },
    { source: "features_text_*", dest: "_text_" },
    { source: "sku", dest: "_text_" },
    { source: "brand_name", dest: "_text_" },
    { source: "category_name", dest: "_text_" },

    // Copy for facet-friendly versions
    { source: "category_name", dest: "category_name_text" },
    { source: "brand_name", dest: "brand_name_text" },
  ];
}

/**
 * Main setup function
 */
async function setupSolrSchema() {
  console.log("\n🔧 Solr Schema Setup");
  console.log("=".repeat(60));
  console.log(`Solr Host: ${SOLR_HOST}:${SOLR_PORT}`);
  console.log(`Core: ${SOLR_CORE}`);
  console.log("=".repeat(60));

  // Check if core exists
  console.log("\n1️⃣ Checking Solr core...");
  const coreExists = await checkSolrCore();
  if (!coreExists) {
    console.error(`❌ Solr core '${SOLR_CORE}' does not exist!`);
    console.log("\nCreate it first:");
    console.log(`  cd /opt/solr`);
    console.log(`  bin/solr create -c ${SOLR_CORE}`);
    process.exit(1);
  }
  console.log(`✅ Core '${SOLR_CORE}' exists`);

  // Add language field types
  console.log("\n2️⃣ Adding language field types...");
  const fieldTypes = getLanguageFieldTypes();
  for (const fieldType of fieldTypes) {
    await addFieldType(fieldType);
  }

  // Add core fields
  console.log("\n3️⃣ Adding core product fields...");
  const coreFields = getCoreFields();
  for (const field of coreFields) {
    await addField(field);
  }

  // Add multilingual fields
  console.log("\n4️⃣ Adding multilingual fields (IT, DE, EN, CS)...");
  const multilingualFields = getMultilingualFields();
  for (const field of multilingualFields) {
    await addField(field);
  }

  // Add dynamic fields
  console.log("\n5️⃣ Adding dynamic fields for additional languages...");
  const dynamicFields = getDynamicFields();
  for (const field of dynamicFields) {
    await addDynamicField(field);
  }

  // Add copy field rules
  console.log("\n6️⃣ Adding copy field rules...");
  const copyFieldRules = getCopyFieldRules();
  for (const rule of copyFieldRules) {
    await addCopyField(rule.source, rule.dest);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Solr schema setup complete!");
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log(`1. View schema: http://${SOLR_HOST}:${SOLR_PORT}/solr/#/${SOLR_CORE}/schema`);
  console.log("2. Index products: npm run index-products");
  console.log("3. Test search: npm run test-search\n");
}

// Run if called directly
if (require.main === module) {
  setupSolrSchema()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("\n❌ Error:", err.message);
      process.exit(1);
    });
}

export { setupSolrSchema };
