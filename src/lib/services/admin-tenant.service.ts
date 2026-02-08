/**
 * Admin Tenant Service
 *
 * Handles tenant provisioning: create, suspend, delete.
 * Creates MongoDB database, Solr core, initial admin user, and seeds languages.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  getTenantModel,
  ITenant,
  ITenantDocument,
  ITenantDomain,
  ITenantApiConfig,
  ITenantDbConfig,
} from "../db/models/admin-tenant";
import { LanguageModel } from "../db/models/language";
import { notifyTenantCacheClear } from "./cache-clear.service";
import { removeFromPool } from "../db/connection-pool";
import {
  seedDefaultTemplates,
  seedCampaignTemplates,
} from "../notifications/seed-templates";
import { initializeHomeSettings } from "../db/home-settings";

// ============================================
// TYPES
// ============================================

export interface CreateTenantInput {
  tenant_id: string;
  name: string;
  admin_email: string;
  admin_password: string;
  admin_name?: string;
  created_by: string;

  // Multi-tenant support fields (optional)
  project_code?: string;
  domains?: ITenantDomain[];
  api?: ITenantApiConfig;
  database?: ITenantDbConfig;
  require_login?: boolean;
  home_settings_customer_id?: string;
  builder_url?: string;
}

export interface TenantProvisionResult {
  tenant: ITenant;
  access_url: string;
}

// ============================================
// CONFIGURATION
// ============================================

const SOLR_ADMIN_URL = process.env.SOLR_URL || process.env.SOLR_ADMIN_URL || "http://149.81.163.109:8983/solr";
const SOLR_CONFIG_SET = process.env.SOLR_CONFIG_SET || "_default";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://cs.vendereincloud.it";

// ============================================
// VALIDATION
// ============================================

const RESERVED_TENANT_IDS = ["admin", "api", "static", "public", "_next", "favicon"];
const TENANT_ID_REGEX = /^[a-z][a-z0-9-]{2,49}$/;

function validateTenantId(tenantId: string): string | null {
  if (!tenantId) {
    return "Tenant ID is required";
  }
  if (!TENANT_ID_REGEX.test(tenantId)) {
    return "Tenant ID must be 3-50 lowercase alphanumeric characters, starting with a letter";
  }
  if (RESERVED_TENANT_IDS.includes(tenantId)) {
    return `Tenant ID '${tenantId}' is reserved`;
  }
  return null;
}

// ============================================
// SOLR OPERATIONS
// ============================================

async function checkSolrCollectionExists(collectionName: string): Promise<boolean> {
  try {
    // Check SolrCloud collections
    const url = `${SOLR_ADMIN_URL}/admin/collections?action=LIST`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.collections && Array.isArray(data.collections)) {
      return data.collections.includes(collectionName);
    }

    // Fallback: check standalone cores
    const coreUrl = `${SOLR_ADMIN_URL}/admin/cores?action=STATUS&core=${collectionName}`;
    const coreResponse = await fetch(coreUrl);
    const coreData = await coreResponse.json();
    return !!(coreData.status && coreData.status[collectionName] && coreData.status[collectionName].name);
  } catch {
    return false;
  }
}

async function createSolrCollection(collectionName: string): Promise<void> {
  // Try creating a SolrCloud collection first
  const collectionUrl = `${SOLR_ADMIN_URL}/admin/collections?action=CREATE&name=${collectionName}&numShards=1&replicationFactor=1&collection.configName=${SOLR_CONFIG_SET}`;

  try {
    const response = await fetch(collectionUrl);
    const data = await response.json();

    if (data.responseHeader?.status === 0) {
      console.log(`Created Solr collection: ${collectionName}`);
      return;
    }

    // Check if collection already exists
    if (data.error?.msg?.includes("already exists")) {
      console.log(`Solr collection ${collectionName} already exists`);
      return;
    }

    // If collection creation failed, try standalone core creation as fallback
    console.log(`Collection creation failed, trying standalone core...`);
  } catch {
    console.log(`Collection API not available, trying standalone core...`);
  }

  // Fallback: create standalone core
  const coreUrl = `${SOLR_ADMIN_URL}/admin/cores?action=CREATE&name=${collectionName}&configSet=${SOLR_CONFIG_SET}`;
  const coreResponse = await fetch(coreUrl);
  const coreData = await coreResponse.json();

  if (coreData.responseHeader?.status !== 0) {
    if (coreData.error?.msg?.includes("already exists")) {
      console.log(`Solr core ${collectionName} already exists`);
      return;
    }
    throw new Error(`Failed to create Solr collection/core: ${JSON.stringify(coreData.error || coreData)}`);
  }

  console.log(`Created Solr core: ${collectionName}`);
}

async function deleteSolrCore(coreName: string): Promise<void> {
  // Try deleting SolrCloud collection first
  const collectionUrl = `${SOLR_ADMIN_URL}/admin/collections?action=DELETE&name=${coreName}`;

  try {
    const response = await fetch(collectionUrl);
    const data = await response.json();

    if (data.responseHeader?.status === 0) {
      console.log(`Deleted Solr collection: ${coreName}`);
      return;
    }

    // If collection doesn't exist, that's fine
    if (data.error?.msg?.includes("not found") || data.error?.msg?.includes("does not exist")) {
      console.log(`Solr collection ${coreName} does not exist (already deleted)`);
      return;
    }

    // If collection API failed for other reasons, try standalone core API
    console.log(`Collection deletion failed, trying standalone core API...`);
  } catch (error) {
    console.log(`Collection API error, trying standalone core API...`, error);
  }

  // Fallback: try deleting as standalone core
  const coreUrl = `${SOLR_ADMIN_URL}/admin/cores?action=UNLOAD&core=${coreName}&deleteIndex=true&deleteDataDir=true&deleteInstanceDir=true`;

  try {
    const response = await fetch(coreUrl);
    const data = await response.json();

    if (data.responseHeader?.status === 0) {
      console.log(`Deleted Solr core: ${coreName}`);
    } else if (data.error?.msg?.includes("Cannot unload non-existent")) {
      console.log(`Solr core ${coreName} does not exist (already deleted)`);
    } else {
      console.warn(`Warning: Failed to delete Solr core ${coreName}:`, data.error);
    }
  } catch (error) {
    console.warn(`Warning: Error deleting Solr core ${coreName}:`, error);
  }
}

// ============================================
// MONGODB OPERATIONS
// ============================================

async function checkMongoDatabaseExists(dbName: string): Promise<boolean> {
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    return false;
  }

  try {
    const connection = await mongoose.createConnection(mongoUrl).asPromise();
    const admin = connection.db?.admin();
    const result = await admin?.listDatabases();
    await connection.close();

    return result?.databases?.some((db: { name: string }) => db.name === dbName) || false;
  } catch {
    return false;
  }
}

async function createTenantDatabase(dbName: string): Promise<mongoose.Connection> {
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    throw new Error("VINC_MONGO_URL is not set");
  }

  const connection = await mongoose.createConnection(mongoUrl, {
    dbName,
  }).asPromise();

  console.log(`Connected to tenant database: ${dbName}`);
  return connection;
}

async function createInitialAdminUser(
  connection: mongoose.Connection,
  email: string,
  password: string,
  name: string,
  companyName: string
): Promise<void> {
  // Define schema inline for tenant connection
  const B2BUserSchema = new mongoose.Schema(
    {
      username: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["admin", "manager", "viewer"], default: "admin" },
      companyName: { type: String, required: true },
      isActive: { type: Boolean, default: true },
      lastLoginAt: { type: Date },
    },
    { timestamps: true }
  );

  const B2BUserModel = connection.model("B2BUser", B2BUserSchema);

  // Check if admin already exists
  const existing = await B2BUserModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`Admin user ${email} already exists in tenant database`);
    return;
  }

  // Create admin user
  const passwordHash = await bcrypt.hash(password, 12);
  const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

  await B2BUserModel.create({
    username,
    email: email.toLowerCase(),
    passwordHash,
    role: "admin",
    companyName,
    isActive: true,
  });

  console.log(`Created initial admin user: ${email}`);
}

async function seedInitialLanguages(connection: mongoose.Connection): Promise<void> {
  // Define Language schema inline for tenant connection
  const LanguageSchema = new mongoose.Schema(
    {
      code: { type: String, required: true, unique: true, lowercase: true },
      name: { type: String, required: true },
      nativeName: { type: String, required: true },
      flag: { type: String },
      isDefault: { type: Boolean, default: false },
      isEnabled: { type: Boolean, default: false },
      searchEnabled: { type: Boolean, default: false },
      solrAnalyzer: { type: String, default: "text_general" },
      direction: { type: String, enum: ["ltr", "rtl"], default: "ltr" },
      dateFormat: { type: String, default: "DD/MM/YYYY" },
      numberFormat: { type: String, default: "en-US" },
      order: { type: Number, required: true },
    },
    {
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      collection: "languages",
    }
  );

  const LanguageModelForTenant = connection.model("Language", LanguageSchema);

  // Check if languages already exist
  const existingCount = await LanguageModelForTenant.countDocuments();
  if (existingCount > 0) {
    console.log(`Languages already seeded (${existingCount} found), skipping`);
    return;
  }

  // 43 languages with flags - only Italian enabled by default
  const initialLanguages = [
    // ========== Currently enabled languages ==========
    { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", isDefault: true, isEnabled: true, searchEnabled: true, solrAnalyzer: "text_it", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "it-IT", order: 1 },

    // ========== Other European languages (disabled by default) ==========
    { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_de", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "de-DE", order: 2 },
    { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_en", direction: "ltr" as const, dateFormat: "MM/DD/YYYY", numberFormat: "en-US", order: 3 },
    { code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "cs-CZ", order: 4 },

    // ========== Additional Western European languages (disabled by default) ==========
    { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fr", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR", order: 5 },
    { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_es", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "es-ES", order: 6 },
    { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_pt", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "pt-PT", order: 7 },
    { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_nl", direction: "ltr" as const, dateFormat: "DD-MM-YYYY", numberFormat: "nl-NL", order: 8 },
    { code: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ca", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ca-ES", order: 9 },

    // ========== Nordic languages ==========
    { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_sv", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "sv-SE", order: 10 },
    { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_da", direction: "ltr" as const, dateFormat: "DD-MM-YYYY", numberFormat: "da-DK", order: 11 },
    { code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fi", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "fi-FI", order: 12 },
    { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_no", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "nb-NO", order: 13 },
    { code: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "is-IS", order: 14 },

    // ========== Central/Eastern European languages ==========
    { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "pl-PL", order: 15 },
    { code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_hu", direction: "ltr" as const, dateFormat: "YYYY.MM.DD", numberFormat: "hu-HU", order: 16 },
    { code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ro", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "ro-RO", order: 17 },
    { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sk-SK", order: 18 },
    { code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sl-SI", order: 19 },
    { code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "hr-HR", order: 20 },
    { code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sr-RS", order: 21 },
    { code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_bg", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "bg-BG", order: 22 },
    { code: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "mk-MK", order: 23 },
    { code: "sq", name: "Albanian", nativeName: "Shqip", flag: "🇦🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sq-AL", order: 24 },

    // ========== Baltic languages ==========
    { code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "et-EE", order: 25 },
    { code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_lv", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "lv-LV", order: 26 },
    { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "lt-LT", order: 27 },

    // ========== Other European languages ==========
    { code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_el", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "el-GR", order: 28 },
    { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ru", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "ru-RU", order: 29 },
    { code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "uk-UA", order: 30 },
    { code: "be", name: "Belarusian", nativeName: "Беларуская", flag: "🇧🇾", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "be-BY", order: 31 },
    { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_tr", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "tr-TR", order: 32 },

    // ========== Middle Eastern/RTL languages ==========
    { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ar", direction: "rtl" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ar-SA", order: 33 },
    { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "rtl" as const, dateFormat: "DD/MM/YYYY", numberFormat: "he-IL", order: 34 },
    { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fa", direction: "rtl" as const, dateFormat: "YYYY/MM/DD", numberFormat: "fa-IR", order: 35 },

    // ========== Asian languages ==========
    { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ja", direction: "ltr" as const, dateFormat: "YYYY/MM/DD", numberFormat: "ja-JP", order: 36 },
    { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_cjk", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "zh-CN", order: 37 },
    { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_cjk", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "ko-KR", order: 38 },
    { code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_th", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "th-TH", order: 39 },
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "vi-VN", order: 40 },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_id", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "id-ID", order: 41 },
    { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ms-MY", order: 42 },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_hi", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "hi-IN", order: 43 },
  ];

  // Seed all languages
  await LanguageModelForTenant.insertMany(initialLanguages);
  console.log(`Seeded ${initialLanguages.length} languages (only Italian enabled by default)`);
}

async function seedInitialNotificationTemplates(dbName: string): Promise<void> {
  try {
    const defaultResult = await seedDefaultTemplates(dbName);
    const campaignResult = await seedCampaignTemplates(dbName);

    const totalCreated = defaultResult.created + campaignResult.created;
    const totalSkipped = defaultResult.skipped + campaignResult.skipped;

    if (totalCreated > 0) {
      console.log(`Seeded ${totalCreated} notification templates (${totalSkipped} skipped)`);
    } else if (totalSkipped > 0) {
      console.log(`Notification templates already seeded (${totalSkipped} found), skipping`);
    }
  } catch (error) {
    // Log but don't fail tenant creation if template seeding fails
    console.warn(`Warning: Failed to seed notification templates:`, error);
  }
}

async function seedInitialHomeSettings(dbName: string, tenantName: string): Promise<void> {
  try {
    const result = await initializeHomeSettings(tenantName, dbName);
    if (result) {
      console.log(`Seeded home settings with default header configuration`);
    }
  } catch (error) {
    // Log but don't fail tenant creation if home settings seeding fails
    console.warn(`Warning: Failed to seed home settings:`, error);
  }
}

async function dropTenantDatabase(dbName: string): Promise<void> {
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    throw new Error("VINC_MONGO_URL is not set");
  }

  try {
    const connection = await mongoose.createConnection(mongoUrl, {
      dbName,
    }).asPromise();

    await connection.dropDatabase();
    await connection.close();
    console.log(`Dropped tenant database: ${dbName}`);
  } catch (error) {
    console.warn(`Warning: Error dropping database ${dbName}:`, error);
  }
}

// ============================================
// MAIN SERVICE FUNCTIONS
// ============================================

/**
 * Create a new tenant with full provisioning.
 */
export async function createTenant(input: CreateTenantInput): Promise<TenantProvisionResult> {
  const { tenant_id, name, admin_email, admin_password, admin_name, created_by } = input;

  // Validate tenant ID
  const validationError = validateTenantId(tenant_id);
  if (validationError) {
    throw new Error(validationError);
  }

  const TenantModel = await getTenantModel();

  // Check if tenant already exists in admin database
  const existing = await TenantModel.findByTenantId(tenant_id);
  if (existing) {
    throw new Error(`Tenant '${tenant_id}' already exists`);
  }

  const solrCore = `vinc-${tenant_id}`;
  const mongoDb = `vinc-${tenant_id}`;

  // Check if Solr collection already exists
  const solrExists = await checkSolrCollectionExists(solrCore);
  if (solrExists) {
    throw new Error(`Solr collection '${solrCore}' already exists. Use a different tenant ID or delete the existing collection first.`);
  }

  // Check if MongoDB database already exists
  const mongoExists = await checkMongoDatabaseExists(mongoDb);
  if (mongoExists) {
    throw new Error(`MongoDB database '${mongoDb}' already exists. Use a different tenant ID or delete the existing database first.`);
  }

  // Step 1: Create Solr collection
  await createSolrCollection(solrCore);

  // Step 2: Create tenant database, initial admin user, and seed data
  let tenantConnection: mongoose.Connection | null = null;
  try {
    tenantConnection = await createTenantDatabase(mongoDb);
    await createInitialAdminUser(
      tenantConnection,
      admin_email,
      admin_password,
      admin_name || name,
      name
    );
    await seedInitialLanguages(tenantConnection);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }

  // Step 3: Seed notification templates (using connectWithModels)
  await seedInitialNotificationTemplates(mongoDb);

  // Step 3b: Seed document templates
  const { seedDocumentTemplates } = await import("./seed-document-templates");
  await seedDocumentTemplates(mongoDb, tenant_id);

  // Step 4: Seed home settings with default header
  await seedInitialHomeSettings(mongoDb, name);

  // Step 5: Register tenant in admin database
  const tenant = await TenantModel.create({
    tenant_id,
    name,
    status: "active",
    admin_email,
    solr_core: solrCore,
    mongo_db: mongoDb,
    created_by,
    // Multi-tenant support fields
    project_code: input.project_code || `vinc-${tenant_id}`,
    domains: input.domains,
    api: input.api,
    database: input.database,
    require_login: input.require_login,
    home_settings_customer_id: input.home_settings_customer_id,
    builder_url: input.builder_url,
  });

  const accessUrl = `${BASE_URL}/${tenant_id}/api/b2b`;

  return {
    tenant: tenant.toObject(),
    access_url: accessUrl,
  };
}

/**
 * Suspend a tenant.
 */
export async function suspendTenant(tenantId: string): Promise<ITenantDocument> {
  const TenantModel = await getTenantModel();

  const tenant = await TenantModel.findByTenantId(tenantId);
  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found`);
  }

  tenant.status = "suspended";
  await tenant.save();

  // Notify b2b instances to clear cache (fire and forget)
  notifyTenantCacheClear({ tenantId }).catch((err) => {
    console.error("[suspendTenant] Cache clear notification failed:", err);
  });

  console.log(`Suspended tenant: ${tenantId}`);
  return tenant;
}

/**
 * Activate a tenant.
 */
export async function activateTenant(tenantId: string): Promise<ITenantDocument> {
  const TenantModel = await getTenantModel();

  const tenant = await TenantModel.findByTenantId(tenantId);
  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found`);
  }

  tenant.status = "active";
  await tenant.save();

  // Notify b2b instances to clear cache (fire and forget)
  notifyTenantCacheClear({ tenantId }).catch((err) => {
    console.error("[activateTenant] Cache clear notification failed:", err);
  });

  console.log(`Activated tenant: ${tenantId}`);
  return tenant;
}

/**
 * Delete a tenant and all its resources.
 * WARNING: This is destructive and irreversible!
 */
export async function deleteTenant(tenantId: string): Promise<void> {
  const TenantModel = await getTenantModel();

  const tenant = await TenantModel.findByTenantId(tenantId);
  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found`);
  }

  // Step 1: Delete Solr core/collection
  await deleteSolrCore(tenant.solr_core);

  // Step 2: Drop MongoDB database
  await dropTenantDatabase(tenant.mongo_db);

  // Step 3: Remove from connection pool (prevents stale connections on re-creation)
  removeFromPool(tenant.mongo_db);

  // Step 4: Remove from admin database
  await TenantModel.deleteOne({ tenant_id: tenantId });

  console.log(`Deleted tenant: ${tenantId}`);
}

/**
 * List all tenants.
 */
export async function listTenants(): Promise<ITenant[]> {
  const TenantModel = await getTenantModel();
  const tenants = await TenantModel.find().sort({ created_at: -1 }).lean();
  return tenants;
}

/**
 * Get a single tenant by ID.
 */
export async function getTenant(tenantId: string): Promise<ITenant | null> {
  const TenantModel = await getTenantModel();
  const tenant = await TenantModel.findByTenantId(tenantId);
  return tenant?.toObject() || null;
}

/**
 * Update tenant details.
 */
export async function updateTenant(
  tenantId: string,
  updates: Partial<Pick<ITenant,
    | "name"
    | "status"
    | "settings"
    | "project_code"
    | "domains"
    | "api"
    | "database"
    | "require_login"
    | "home_settings_customer_id"
    | "builder_url"
  >>
): Promise<ITenantDocument> {
  const TenantModel = await getTenantModel();

  const tenant = await TenantModel.findByTenantId(tenantId);
  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found`);
  }

  if (updates.name !== undefined) tenant.name = updates.name;
  if (updates.status !== undefined) tenant.status = updates.status;
  if (updates.settings !== undefined) tenant.settings = updates.settings;

  // Multi-tenant support fields
  if (updates.project_code !== undefined) tenant.project_code = updates.project_code;
  if (updates.domains !== undefined) tenant.domains = updates.domains;
  if (updates.api !== undefined) tenant.api = updates.api;
  if (updates.database !== undefined) tenant.database = updates.database;
  if (updates.require_login !== undefined) tenant.require_login = updates.require_login;
  if (updates.home_settings_customer_id !== undefined) tenant.home_settings_customer_id = updates.home_settings_customer_id;
  if (updates.builder_url !== undefined) tenant.builder_url = updates.builder_url;

  await tenant.save();

  // Notify b2b instances to clear cache (fire and forget)
  notifyTenantCacheClear({ tenantId }).catch((err) => {
    console.error("[updateTenant] Cache clear notification failed:", err);
  });

  return tenant;
}

/**
 * Get tenant by domain hostname.
 */
export async function getTenantByDomain(hostname: string): Promise<ITenant | null> {
  const TenantModel = await getTenantModel();
  const tenant = await TenantModel.findByDomain(hostname);
  return tenant?.toObject() || null;
}
