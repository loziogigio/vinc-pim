/**
 * Project Configuration
 * SINGLE SOURCE OF TRUTH for instance/tenant configuration
 * Used by: MongoDB connection, Solr adapter, all services
 */

export interface ProjectConfig {
  tenantId: string;
  projectId: string;
  mongoDatabase: string;
  solrCore: string;
  solrUrl: string;
  mongoUrl: string;
  defaultLanguage: string;
  enabledLanguages: string[];
}

/**
 * Helper to read env var at runtime (prevents webpack inlining)
 */
function getEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get resolved instance name from environment
 * Priority: VINC_TENANT_ID → vinc-${VINC_TENANT_ID}, else VINC_MONGO_DB
 */
export function getInstanceName(): string {
  const tenantId = getEnv('VINC_TENANT_ID');
  if (tenantId) {
    return `vinc-${tenantId}`;
  }
  return getEnv('VINC_MONGO_DB') ?? 'app';
}

/**
 * Get project configuration from environment or defaults
 * Uses getEnv() to prevent webpack from inlining env vars at build time
 */
export function getProjectConfig(): ProjectConfig {
  const tenantId = getEnv('VINC_TENANT_ID') || 'default';
  const projectId = getEnv('PROJECT_ID') || 'default';

  // Single source of truth: instance name used for both MongoDB and Solr
  const instanceName = getInstanceName();

  // MongoDB database name (can be overridden with VINC_MONGO_DB_OVERRIDE)
  const mongoDatabase = getEnv('VINC_MONGO_DB_OVERRIDE') || instanceName;

  // Solr collection (can be overridden with SOLR_CORE)
  const solrCore = getEnv('SOLR_CORE') || instanceName;

  // Connection URLs
  const solrUrl = getEnv('SOLR_URL') || 'http://localhost:8983/solr';
  const mongoUrl = getEnv('VINC_MONGO_URL') || 'mongodb://admin:admin@localhost:27017/?authSource=admin';

  // Default language is Italian
  const defaultLanguage = getEnv('DEFAULT_LANGUAGE') || "it";

  // Initially enabled languages (can be changed via admin)
  const enabledLanguages = getEnv('ENABLED_LANGUAGES')?.split(",") || ["it"];

  return {
    tenantId,
    projectId,
    mongoDatabase,
    solrCore,
    solrUrl,
    mongoUrl,
    defaultLanguage,
    enabledLanguages,
  };
}

/**
 * Validate project configuration
 */
export function validateProjectConfig(config: ProjectConfig): void {
  // Default language must be enabled
  if (!config.enabledLanguages.includes(config.defaultLanguage)) {
    throw new Error(
      `Default language (${config.defaultLanguage}) must be in enabled languages list`
    );
  }

  // Italian must always be enabled (business requirement)
  if (!config.enabledLanguages.includes("it")) {
    throw new Error("Italian (it) must always be enabled as it's the default language");
  }
}

/**
 * Ensure Solr collection exists in SolrCloud mode, create if needed
 */
async function ensureSolrCore(config: ProjectConfig): Promise<void> {
  try {
    // In SolrCloud mode, check if collection exists
    const listUrl = `${config.solrUrl}/admin/collections?action=LIST&wt=json`;
    const response = await fetch(listUrl);
    const data = await response.json();

    // Check if collection exists
    if (data.collections && data.collections.includes(config.solrCore)) {
      console.log(`Solr collection '${config.solrCore}' exists`);
      return;
    }

    // Collection doesn't exist, create it
    console.log(`Creating Solr collection '${config.solrCore}'...`);
    const createUrl = `${config.solrUrl}/admin/collections?action=CREATE&name=${config.solrCore}&numShards=1&replicationFactor=1&collection.configName=_default&wt=json`;
    const createResponse = await fetch(createUrl);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create Solr collection: ${createResponse.statusText} - ${errorText}`);
    }

    const createData = await createResponse.json();
    if (createData.error) {
      throw new Error(`Solr error: ${createData.error.msg || JSON.stringify(createData.error)}`);
    }

    console.log(`Solr collection '${config.solrCore}' created successfully`);
  } catch (error: any) {
    console.warn(`Could not verify/create Solr collection: ${error.message}`);
    console.warn(`Make sure Solr is running in SolrCloud mode and accessible at ${config.solrUrl}`);
  }
}

/**
 * Get project config - call this function to read env vars at RUNTIME
 * DO NOT use a singleton - values must be read fresh for Docker deployments
 */
export function projectConfig(): ProjectConfig {
  const config = getProjectConfig();
  validateProjectConfig(config);
  return config;
}

// Export ensureSolrCore for use in enable-search endpoint
export { ensureSolrCore };

// ============================================
// SOLR CONFIGURATION
// ============================================

export interface SolrConfig {
  url: string;
  core: string;
  defaultRows: number;
  maxRows: number;
  facetLimit: number;
  facetMinCount: number;
}

/**
 * Get Solr configuration - single source of truth
 */
export function getSolrConfig(): SolrConfig {
  const config = getProjectConfig();

  return {
    url: config.solrUrl,
    core: config.solrCore,
    defaultRows: parseInt(getEnv('SEARCH_DEFAULT_ROWS') || '20', 10),
    maxRows: parseInt(getEnv('SEARCH_MAX_ROWS') || '100', 10),
    facetLimit: parseInt(getEnv('FACET_DEFAULT_LIMIT') || '100', 10),
    facetMinCount: parseInt(getEnv('FACET_MIN_COUNT') || '1', 10),
  };
}

/**
 * Check if Solr is enabled
 */
export function isSolrEnabled(): boolean {
  return getEnv('SOLR_ENABLED') === 'true';
}

/**
 * MULTILINGUAL_FIELDS - Single source of truth
 * Fields that support multilingual data (language-keyed objects)
 * Used by: parser.ts, import API routes, transformers
 */
export const MULTILINGUAL_FIELDS = [
  "name",
  "description",
  "short_description",
  "features",
  "specifications",
  "attributes",
  "meta_title",
  "meta_description",
  "keywords",
] as const;

export type MultilingualField = typeof MULTILINGUAL_FIELDS[number];
