/**
 * Project Configuration
 * Configuration for project-specific settings (MongoDB, Solr, languages)
 */

export interface ProjectConfig {
  projectId: string;
  mongoDatabase: string;
  solrCore: string;
  defaultLanguage: string;
  enabledLanguages: string[];
}

/**
 * Get project configuration from environment or defaults
 */
export function getProjectConfig(): ProjectConfig {
  const projectId = process.env.PROJECT_ID || "default";
  const mongoDatabase = process.env.VINC_MONGO_DB || "app";

  // Solr collection MUST match MongoDB database name (SolrCloud mode)
  const solrCore = mongoDatabase;

  // Default language is Italian
  const defaultLanguage = process.env.DEFAULT_LANGUAGE || "it";

  // Initially enabled languages (can be changed via admin)
  const enabledLanguages = process.env.ENABLED_LANGUAGES?.split(",") || ["it"];

  return {
    projectId,
    mongoDatabase,
    solrCore,
    defaultLanguage,
    enabledLanguages,
  };
}

/**
 * Validate project configuration
 */
export function validateProjectConfig(config: ProjectConfig): void {
  // Solr collection MUST match MongoDB database (SolrCloud mode)
  if (config.solrCore !== config.mongoDatabase) {
    throw new Error(
      `Solr collection name (${config.solrCore}) must match MongoDB database name (${config.mongoDatabase})`
    );
  }

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
  const SOLR_HOST = process.env.SOLR_HOST || "localhost";
  const SOLR_PORT = process.env.SOLR_PORT || "8983";
  const solrBaseUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;

  try {
    // In SolrCloud mode, check if collection exists
    const listUrl = `${solrBaseUrl}/admin/collections?action=LIST&wt=json`;
    const response = await fetch(listUrl);
    const data = await response.json();

    // Check if collection exists
    if (data.collections && data.collections.includes(config.solrCore)) {
      console.log(`✅ Solr collection '${config.solrCore}' exists`);
      return;
    }

    // Collection doesn't exist, create it
    console.log(`📦 Creating Solr collection '${config.solrCore}'...`);
    const createUrl = `${solrBaseUrl}/admin/collections?action=CREATE&name=${config.solrCore}&numShards=1&replicationFactor=1&collection.configName=_default&wt=json`;
    const createResponse = await fetch(createUrl);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create Solr collection: ${createResponse.statusText} - ${errorText}`);
    }

    const createData = await createResponse.json();
    if (createData.error) {
      throw new Error(`Solr error: ${createData.error.msg || JSON.stringify(createData.error)}`);
    }

    console.log(`✅ Solr collection '${config.solrCore}' created successfully`);
  } catch (error: any) {
    console.warn(`⚠️  Could not verify/create Solr collection: ${error.message}`);
    console.warn(`   Make sure Solr is running in SolrCloud mode and accessible at ${solrBaseUrl}`);
  }
}

// Export singleton instance
export const projectConfig = getProjectConfig();
validateProjectConfig(projectConfig);

// Log configuration on startup
console.log("📋 Project Configuration:");
console.log(`   Project ID: ${projectConfig.projectId}`);
console.log(`   MongoDB Database: ${projectConfig.mongoDatabase}`);
console.log(`   Solr Collection: ${projectConfig.solrCore} (SolrCloud mode)`);
console.log(`   Default Language: ${projectConfig.defaultLanguage}`);
console.log(`   Enabled Languages: ${projectConfig.enabledLanguages.join(", ")}`);

// Export ensureSolrCore for use in enable-search endpoint
export { ensureSolrCore };
