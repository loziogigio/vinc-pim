/**
 * Solr Schema Management Service
 * Automatically manages Solr schema fields when languages are enabled/disabled
 */

import { ILanguage } from "../lib/db/models/language";
import { projectConfig } from "../config/project.config";

export interface SolrConfig {
  host: string;
  port: number;
  core: string;
}

/**
 * Solr configuration
 * IMPORTANT: Solr core name MUST match MongoDB database name (project-specific)
 */
const DEFAULT_SOLR_CONFIG: SolrConfig = {
  host: process.env.SOLR_HOST || "localhost",
  port: parseInt(process.env.SOLR_PORT || "8983"),
  // Solr core name matches MongoDB database name
  core: projectConfig.solrCore,
};

/**
 * Product fields that need multilingual versions in Solr
 * Field naming convention: {field_name}_text_{lang}
 * Based on product-full-multilingual-structure.json
 */
const MULTILINGUAL_FIELDS = [
  // Core product fields
  { name: "name", multiValued: false },
  { name: "slug", multiValued: false },
  { name: "description", multiValued: false },
  { name: "short_description", multiValued: false },
  { name: "features", multiValued: true },

  // SEO fields
  { name: "meta_title", multiValued: false },
  { name: "meta_description", multiValued: false },
  { name: "meta_keywords", multiValued: true },

  // Nested object labels (extracted for search)
  { name: "spec_labels", multiValued: true },     // Specification labels
  { name: "attr_labels", multiValued: true },     // Attribute labels
  { name: "media_labels", multiValued: true },    // Media labels

  // Relationship fields (names and slugs)
  { name: "category_name", multiValued: false },
  { name: "category_slug", multiValued: false },
  { name: "collection_names", multiValued: true },
  { name: "collection_slugs", multiValued: true },
  { name: "tag_names", multiValued: true },
  { name: "product_type_name", multiValued: false },
  { name: "product_type_slug", multiValued: false },

  // Additional translatable fields
  { name: "packaging_labels", multiValued: true },
  { name: "promo_labels", multiValued: true },
  { name: "product_type_feature_labels", multiValued: true },
];

/**
 * Get Solr Schema API base URL
 */
function getSolrSchemaUrl(config: SolrConfig = DEFAULT_SOLR_CONFIG): string {
  return `http://${config.host}:${config.port}/solr/${config.core}/schema`;
}

/**
 * Check if a field exists in Solr schema
 */
export async function solrFieldExists(
  fieldName: string,
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<boolean> {
  try {
    const url = `${getSolrSchemaUrl(config)}/fields/${fieldName}`;
    const response = await fetch(url);
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new Error(`Solr request failed: ${response.statusText}`);
    }
    return response.status === 200;
  } catch (error: any) {
    if (error.message?.includes("404")) {
      return false;
    }
    throw error;
  }
}

/**
 * Check if a field type exists in Solr schema
 */
export async function solrFieldTypeExists(
  typeName: string,
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<boolean> {
  try {
    const url = `${getSolrSchemaUrl(config)}/fieldtypes/${typeName}`;
    const response = await fetch(url);
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new Error(`Solr request failed: ${response.statusText}`);
    }
    return response.status === 200;
  } catch (error: any) {
    if (error.message?.includes("404")) {
      return false;
    }
    throw error;
  }
}

/**
 * Add language-specific field type to Solr if it doesn't exist
 */
export async function ensureSolrFieldType(
  language: ILanguage,
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<void> {
  const typeName = language.solrAnalyzer;

  // Check if already exists
  const exists = await solrFieldTypeExists(typeName, config);
  if (exists) {
    console.log(`  ✓ Field type '${typeName}' already exists in Solr`);
    return;
  }

  // Field type definitions for different analyzers
  const fieldTypeDefinitions: Record<string, any> = {
    text_it: {
      name: "text_it",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_it.txt", ignoreCase: "true" },
          { class: "solr.ItalianLightStemFilterFactory" },
        ],
      },
    },
    text_de: {
      name: "text_de",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_de.txt", ignoreCase: "true" },
          { class: "solr.GermanNormalizationFilterFactory" },
          { class: "solr.GermanLightStemFilterFactory" },
        ],
      },
    },
    text_en: {
      name: "text_en",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_en.txt", ignoreCase: "true" },
          { class: "solr.PorterStemFilterFactory" },
        ],
      },
    },
    text_fr: {
      name: "text_fr",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.ElisionFilterFactory", articles: "lang/contractions_fr.txt", ignoreCase: "true" },
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_fr.txt", ignoreCase: "true" },
          { class: "solr.FrenchLightStemFilterFactory" },
        ],
      },
    },
    text_es: {
      name: "text_es",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_es.txt", ignoreCase: "true" },
          { class: "solr.SpanishLightStemFilterFactory" },
        ],
      },
    },
    text_pt: {
      name: "text_pt",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_pt.txt", ignoreCase: "true" },
          { class: "solr.PortugueseLightStemFilterFactory" },
        ],
      },
    },
    text_nl: {
      name: "text_nl",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_nl.txt", ignoreCase: "true" },
          { class: "solr.DutchStemFilterFactory" },
        ],
      },
    },
    text_ru: {
      name: "text_ru",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_ru.txt", ignoreCase: "true" },
          { class: "solr.RussianLightStemFilterFactory" },
        ],
      },
    },
    text_ar: {
      name: "text_ar",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_ar.txt", ignoreCase: "true" },
          { class: "solr.ArabicNormalizationFilterFactory" },
          { class: "solr.ArabicStemFilterFactory" },
        ],
      },
    },
    text_ja: {
      name: "text_ja",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.JapaneseTokenizerFactory", mode: "search" },
        filters: [
          { class: "solr.JapaneseBaseFormFilterFactory" },
          { class: "solr.JapanesePartOfSpeechStopFilterFactory" },
          { class: "solr.CJKWidthFilterFactory" },
          { class: "solr.LowerCaseFilterFactory" },
        ],
      },
    },
    text_cjk: {
      name: "text_cjk",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.CJKWidthFilterFactory" },
          { class: "solr.CJKBigramFilterFactory" },
          { class: "solr.LowerCaseFilterFactory" },
        ],
      },
    },
    text_th: {
      name: "text_th",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.ThaiTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_th.txt", ignoreCase: "true" },
        ],
      },
    },
    text_hi: {
      name: "text_hi",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
          { class: "solr.IndicNormalizationFilterFactory" },
          { class: "solr.HindiNormalizationFilterFactory" },
          { class: "solr.StopFilterFactory", words: "lang/stopwords_hi.txt", ignoreCase: "true" },
          { class: "solr.HindiStemFilterFactory" },
        ],
      },
    },
    text_general: {
      name: "text_general",
      class: "solr.TextField",
      analyzer: {
        tokenizer: { class: "solr.StandardTokenizerFactory" },
        filters: [
          { class: "solr.LowerCaseFilterFactory" },
        ],
      },
    },
  };

  const fieldTypeDef = fieldTypeDefinitions[typeName];
  if (!fieldTypeDef) {
    console.log(`  ⚠️  No field type definition for '${typeName}', using text_general`);
    return;
  }

  try {
    // POST request goes to /schema (not /schema/fieldtypes)
    const url = getSolrSchemaUrl(config);
    console.log(`  🔗 Posting to Solr schema API: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "add-field-type": fieldTypeDef }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`  ❌ Solr responded with ${response.status} ${response.statusText}`);
      console.error(`  📍 URL: ${url}`);
      console.error(`  📄 Response: ${errorData}`);
      throw new Error(`Solr request failed: ${response.statusText} - ${errorData}`);
    }

    console.log(`  ✅ Added field type '${typeName}' to Solr schema`);
  } catch (error: any) {
    console.error(`  ❌ Failed to add field type '${typeName}':`, error.message);
    throw error;
  }
}

/**
 * Verify Solr schema API is accessible
 */
async function verifySolrSchemaApi(config: SolrConfig = DEFAULT_SOLR_CONFIG): Promise<boolean> {
  try {
    const url = getSolrSchemaUrl(config);
    console.log(`  🔍 Verifying Solr schema API at: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(`  ❌ Schema API not accessible: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    console.log(`  ✅ Schema API accessible, version: ${data.schema?.version || 'unknown'}`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ Failed to verify schema API:`, error.message);
    return false;
  }
}

/**
 * Add fields for a language to Solr schema
 */
export async function addLanguageFieldsToSolr(
  language: ILanguage,
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<void> {
  console.log(`\n📝 Adding Solr fields for ${language.code} (${language.name})...`);

  // Verify schema API is accessible
  const isAccessible = await verifySolrSchemaApi(config);
  if (!isAccessible) {
    throw new Error(
      `Solr Schema API is not accessible at ${getSolrSchemaUrl(config)}. ` +
      `Make sure the Solr core '${config.core}' exists and has managed schema enabled.`
    );
  }

  // Ensure field type exists
  await ensureSolrFieldType(language, config);

  // POST request goes to /schema (not /schema/fields)
  const url = getSolrSchemaUrl(config);
  const fieldsToAdd: any[] = [];

  for (const field of MULTILINGUAL_FIELDS) {
    const fieldName = `${field.name}_${language.solrAnalyzer}`;

    // Check if field already exists
    const exists = await solrFieldExists(fieldName, config);
    if (exists) {
      console.log(`  ✓ Field '${fieldName}' already exists`);
      continue;
    }

    fieldsToAdd.push({
      name: fieldName,
      type: language.solrAnalyzer,
      stored: true,
      indexed: true,
      multiValued: field.multiValued,
    });
  }

  if (fieldsToAdd.length === 0) {
    console.log(`  ✓ All fields for '${language.code}' already exist in Solr`);
    return;
  }

  try {
    // Add all fields in one request
    const commands = fieldsToAdd.map(field => ({ "add-field": field }));

    for (const command of commands) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Solr request failed: ${response.statusText} - ${errorData}`);
      }

      console.log(`  ✅ Added field '${command["add-field"].name}'`);
    }

    console.log(`✅ Successfully added ${fieldsToAdd.length} fields for '${language.code}'`);
  } catch (error: any) {
    console.error(`❌ Failed to add fields:`, error.message);
    throw error;
  }
}

/**
 * Remove fields for a language from Solr schema
 */
export async function removeLanguageFieldsFromSolr(
  language: ILanguage,
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<void> {
  console.log(`\n🗑️  Removing Solr fields for ${language.code} (${language.name})...`);

  const url = `${getSolrSchemaUrl(config)}/fields`;
  const fieldsToRemove: string[] = [];

  for (const field of MULTILINGUAL_FIELDS) {
    const fieldName = `${field.name}_${language.solrAnalyzer}`;

    // Check if field exists
    const exists = await solrFieldExists(fieldName, config);
    if (exists) {
      fieldsToRemove.push(fieldName);
    }
  }

  if (fieldsToRemove.length === 0) {
    console.log(`  ✓ No fields to remove for '${language.code}'`);
    return;
  }

  try {
    // Note: Solr doesn't allow deleting fields with data
    // You may need to clear the index first or use replace-field
    console.log(`  ⚠️  Warning: Cannot delete fields from Solr schema that contain data`);
    console.log(`  ⚠️  Consider reindexing without this language instead`);
    console.log(`  Fields that would be removed: ${fieldsToRemove.join(", ")}`);
  } catch (error: any) {
    console.error(`❌ Failed to remove fields:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Base non-language fields that all collections need
 */
const BASE_FIELDS = [
  // Core identifiers
  { name: "sku", type: "string", stored: true, indexed: true },
  { name: "entity_code", type: "string", stored: true, indexed: true },
  { name: "ean", type: "strings", stored: true, indexed: true },

  // Versioning & status
  { name: "version", type: "pint", stored: true, indexed: true },
  { name: "isCurrent", type: "boolean", stored: true, indexed: true },
  { name: "isCurrentPublished", type: "boolean", stored: true, indexed: true },
  { name: "status", type: "string", stored: true, indexed: true, docValues: true },
  { name: "product_status", type: "string", stored: true, indexed: true },

  // Dates
  { name: "created_at", type: "pdate", stored: true, indexed: true },
  { name: "updated_at", type: "pdate", stored: true, indexed: true },
  { name: "published_at", type: "pdate", stored: true, indexed: true },

  // Inventory & Pricing
  { name: "price", type: "pdouble", stored: true, indexed: true },
  { name: "quantity", type: "pint", stored: true, indexed: true },
  { name: "sold", type: "pint", stored: true, indexed: true },
  { name: "unit", type: "string", stored: true, indexed: true },
  { name: "stock_status", type: "string", stored: true, indexed: true, docValues: true },

  // Quality
  { name: "completeness_score", type: "pint", stored: true, indexed: true },

  // Analytics
  { name: "views_30d", type: "pint", stored: true, indexed: true },
  { name: "clicks_30d", type: "pint", stored: true, indexed: true },
  { name: "add_to_cart_30d", type: "pint", stored: true, indexed: true },
  { name: "conversions_30d", type: "pint", stored: true, indexed: true },
  { name: "priority_score", type: "pint", stored: true, indexed: true },

  // Promotions
  { name: "promo_code", type: "strings", stored: true, indexed: true },
  { name: "promo_type", type: "strings", stored: true, indexed: true },    // Business categories for faceting (STD, XXX, OMG, etc.)
  { name: "has_active_promo", type: "boolean", stored: true, indexed: true },

  // Media
  { name: "has_video", type: "boolean", stored: true, indexed: true },
  { name: "image_count", type: "pint", stored: true, indexed: true },
  { name: "cover_image_url", type: "string", stored: true, indexed: false },

  // Variations
  { name: "is_parent", type: "boolean", stored: true, indexed: true },
  { name: "parent_sku", type: "string", stored: true, indexed: true },
  { name: "parent_entity_code", type: "string", stored: true, indexed: true },

  // Relationships (IDs)
  { name: "category_id", type: "string", stored: true, indexed: true },
  { name: "brand_id", type: "string", stored: true, indexed: true },
  { name: "product_type_id", type: "string", stored: true, indexed: true },
  { name: "collection_ids", type: "strings", stored: true, indexed: true },

  // Variations & Faceting Control
  { name: "include_faceting", type: "boolean", stored: true, indexed: true },
  { name: "variations_sku", type: "strings", stored: true, indexed: true },
  { name: "variations_entity_code", type: "strings", stored: true, indexed: true },
  { name: "product_model", type: "string", stored: true, indexed: true },

  // Hierarchy paths for faceting
  { name: "category_path", type: "strings", stored: true, indexed: true },
  { name: "category_ancestors", type: "strings", stored: true, indexed: true },
  { name: "category_level", type: "pint", stored: true, indexed: true },
  { name: "brand_path", type: "strings", stored: true, indexed: true },
  { name: "brand_ancestors", type: "strings", stored: true, indexed: true },
  { name: "brand_family", type: "string", stored: true, indexed: true },
  { name: "product_type_path", type: "strings", stored: true, indexed: true },
  { name: "product_type_ancestors", type: "strings", stored: true, indexed: true },
  { name: "product_type_level", type: "pint", stored: true, indexed: true },
  { name: "collection_paths", type: "strings", stored: true, indexed: true },
  { name: "collection_ancestors", type: "strings", stored: true, indexed: true },

  // Tags for faceting
  { name: "tag_groups", type: "strings", stored: true, indexed: true },
  { name: "tag_categories", type: "strings", stored: true, indexed: true },

  // Complex objects stored as JSON (for frontend display, not faceting)
  { name: "specifications_json", type: "string", stored: true, indexed: false },
  { name: "attributes_json", type: "string", stored: true, indexed: false },
  { name: "media_json", type: "string", stored: true, indexed: false },
  { name: "packaging_json", type: "string", stored: true, indexed: false },
  { name: "promotions_json", type: "string", stored: true, indexed: false },
  { name: "product_type_features_json", type: "string", stored: true, indexed: false },

  // Relationship objects with multilingual content (stored as JSON)
  { name: "category_json", type: "string", stored: true, indexed: false },
  { name: "brand_json", type: "string", stored: true, indexed: false },
  { name: "collections_json", type: "string", stored: true, indexed: false },
  { name: "product_type_json", type: "string", stored: true, indexed: false },

  // Additional JSON fields for enriched response
  { name: "tags_json", type: "string", stored: true, indexed: false },
  { name: "image_json", type: "string", stored: true, indexed: false },
  { name: "images_json", type: "string", stored: true, indexed: false },
  { name: "gallery_json", type: "string", stored: true, indexed: false },
  { name: "parent_product_json", type: "string", stored: true, indexed: false },
  { name: "sibling_variants_json", type: "string", stored: true, indexed: false },
  { name: "source_json", type: "string", stored: true, indexed: false },
];

/**
 * Dynamic fields for attribute faceting
 * These use Solr's built-in dynamic field patterns with type-specific suffixes:
 * - attribute_{key}_s → string values (e.g., attribute_colore_s = "ROSSO")
 * - attribute_{key}_f → float values (e.g., attribute_peso_f = 12.5)
 * - attribute_{key}_b → boolean values (e.g., attribute_disponibile_b = true)
 *
 * The dynamic field patterns (*_s, *_f, *_b) are built into Solr and don't
 * need explicit creation. The adapter automatically detects the value type
 * and indexes attributes using the appropriate suffix when syncing products.
 */

/**
 * Ensure base non-language fields exist in Solr schema
 */
export async function ensureBaseFields(
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<void> {
  console.log("\n📋 Ensuring base fields in Solr schema...");

  const url = getSolrSchemaUrl(config);
  const fieldsToAdd: any[] = [];

  for (const field of BASE_FIELDS) {
    const exists = await solrFieldExists(field.name, config);
    if (exists) {
      console.log(`  ✓ Field '${field.name}' already exists`);
      continue;
    }

    fieldsToAdd.push(field);
  }

  if (fieldsToAdd.length === 0) {
    console.log("  ✓ All base fields already exist");
    return;
  }

  try {
    // Add fields one by one
    for (const field of fieldsToAdd) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "add-field": field }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to add field ${field.name}: ${response.statusText} - ${errorData}`);
      }

      console.log(`  ✅ Added field '${field.name}'`);
    }

    console.log(`✅ Successfully added ${fieldsToAdd.length} base fields`);
  } catch (error: any) {
    console.error(`❌ Failed to add base fields:`, error.message);
    throw error;
  }
}

/**
 * Sync all enabled languages with Solr schema
 */
export async function syncSolrSchemaWithLanguages(
  languages: ILanguage[],
  config: SolrConfig = DEFAULT_SOLR_CONFIG
): Promise<void> {
  console.log("\n🔄 Syncing Solr schema with enabled languages...\n");

  // Ensure base fields exist first
  await ensureBaseFields(config);

  for (const language of languages) {
    await addLanguageFieldsToSolr(language, config);
  }

  console.log("\n✅ Solr schema sync complete!\n");
}
