/**
 * Marketplace Adapter Registry
 * Central registry for all marketplace adapters
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { MarketplaceConfig } from './types';
import { SolrAdapter } from './solr-adapter';
import { EbayAdapter } from './ebay-adapter';
import { AmazonAdapter } from './amazon-adapter';
import { TrovaprezziAdapter } from './trovaprezzi-adapter';
import { ManoManoAdapter } from './manomano-adapter';
import { B2BAdapter } from './b2b-adapter';
import { B2CAdapter } from './b2c-adapter';
import { projectConfig } from '@/config/project.config';

/**
 * Adapter registry type mapping
 */
type AdapterClass = new (config: MarketplaceConfig) => MarketplaceAdapter;

/**
 * Registry of available adapters
 */
const ADAPTER_REGISTRY: Record<string, AdapterClass> = {
  solr: SolrAdapter,
  ebay: EbayAdapter,
  amazon: AmazonAdapter,
  trovaprezzi: TrovaprezziAdapter,
  manomano: ManoManoAdapter,
  b2b: B2BAdapter,
  b2c: B2CAdapter,
};

/**
 * Adapter Factory
 * Creates adapter instances with configuration
 */
export class AdapterFactory {
  private static instances: Map<string, MarketplaceAdapter> = new Map();

  /**
   * Create a new adapter instance
   */
  static create(
    adapterType: string,
    config: MarketplaceConfig
  ): MarketplaceAdapter {
    const AdapterClass = ADAPTER_REGISTRY[adapterType];

    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${adapterType}`);
    }

    return new AdapterClass(config);
  }

  /**
   * Get or create a singleton adapter instance
   */
  static getInstance(
    adapterType: string,
    config: MarketplaceConfig
  ): MarketplaceAdapter {
    const cacheKey = `${adapterType}`;

    if (!this.instances.has(cacheKey)) {
      const adapter = this.create(adapterType, config);
      this.instances.set(cacheKey, adapter);
    }

    return this.instances.get(cacheKey)!;
  }

  /**
   * Clear all adapter instances (useful for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Get list of available adapter types
   */
  static getAvailableAdapters(): string[] {
    return Object.keys(ADAPTER_REGISTRY);
  }
}

/**
 * Load adapter configurations from environment variables
 */
export function loadAdapterConfigs(): Record<string, MarketplaceConfig> {
  return {
    solr: {
      enabled: process.env.SOLR_ENABLED === 'true',
      custom_config: {
        // Single source of truth: projectConfig
        solr_url: projectConfig.solrUrl,
        solr_core: projectConfig.solrCore,
      },
    },
    ebay: {
      enabled: process.env.EBAY_ENABLED === 'true',
      app_id: process.env.EBAY_APP_ID,
      api_secret: process.env.EBAY_API_SECRET,
      access_token: process.env.EBAY_ACCESS_TOKEN,
      environment: (process.env.EBAY_ENVIRONMENT as any) || 'sandbox',
      custom_config: {
        fulfillment_policy_id: process.env.EBAY_FULFILLMENT_POLICY_ID,
        payment_policy_id: process.env.EBAY_PAYMENT_POLICY_ID,
        return_policy_id: process.env.EBAY_RETURN_POLICY_ID,
      },
    },
    amazon: {
      enabled: process.env.AMAZON_ENABLED === 'true',
      app_id: process.env.AMAZON_APP_ID,
      api_secret: process.env.AMAZON_API_SECRET,
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      environment: (process.env.AMAZON_ENVIRONMENT as any) || 'sandbox',
      custom_config: {
        marketplace_id: process.env.AMAZON_MARKETPLACE_ID || 'A11IL2PNWYJU7H', // Italy
        merchant_id: process.env.AMAZON_MERCHANT_ID,
      },
    },
    trovaprezzi: {
      enabled: process.env.TROVAPREZZI_ENABLED === 'true',
      custom_config: {
        feed_url: process.env.TROVAPREZZI_FEED_URL,
      },
    },
    manomano: {
      enabled: process.env.MANOMANO_ENABLED === 'true',
      api_key: process.env.MANOMANO_API_KEY,
    },
    b2b: {
      enabled: process.env.B2B_ENABLED === 'true',
      api_key: process.env.B2B_API_KEY,
      custom_config: {
        api_url: process.env.B2B_API_URL || 'http://localhost:3001',
        tenant_id: process.env.B2B_TENANT_ID || process.env.VINC_TENANT_ID,
      },
    },
    b2c: {
      enabled: process.env.B2C_ENABLED === 'true',
      api_key: process.env.B2C_API_KEY,
      custom_config: {
        api_url: process.env.B2C_API_URL || 'http://localhost:3002',
        store_id: process.env.B2C_STORE_ID,
      },
    },
  };
}

/**
 * Initialize all enabled adapters
 */
export async function initializeAdapters(): Promise<Map<string, MarketplaceAdapter>> {
  const configs = loadAdapterConfigs();
  const adapters = new Map<string, MarketplaceAdapter>();

  for (const [type, config] of Object.entries(configs)) {
    if (!config.enabled) {
      console.log(`[AdapterFactory] ${type} adapter is disabled, skipping`);
      continue;
    }

    try {
      const adapter = AdapterFactory.getInstance(type, config);
      await adapter.initialize();
      adapters.set(type, adapter);
      console.log(`[AdapterFactory] ✓ Initialized ${adapter.name} adapter`);
    } catch (error: any) {
      console.error(`[AdapterFactory] ✗ Failed to initialize ${type} adapter:`, error.message);
      // Don't throw, continue with other adapters
    }
  }

  return adapters;
}

// Export all types and adapters
export * from './types';
export * from './marketplace-adapter';
export { SolrAdapter } from './solr-adapter';
export { EbayAdapter } from './ebay-adapter';
export { AmazonAdapter } from './amazon-adapter';
export { TrovaprezziAdapter } from './trovaprezzi-adapter';
export { ManoManoAdapter } from './manomano-adapter';
export { B2BAdapter } from './b2b-adapter';
export { B2CAdapter } from './b2c-adapter';
