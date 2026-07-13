/**
 * CDN Configuration Adapter
 *
 * Loads CDN configuration from MongoDB homeSettings and transforms it
 * to the format expected by the vinc-cdn package.
 */

import type { CdnConfig } from "vinc-cdn";
import { getHomeSettings } from "@/lib/db/home-settings";
import type { CDNCredentials } from "@/lib/types/home-settings";

// Keep tenant configurations isolated when multiple tenants share one process.
const cachedConfigs = new Map<string, { config: CdnConfig; cachedAt: number }>();
const CONFIG_CACHE_TTL = 60000; // 1 minute cache
const AUTO_DETECTED_TENANT_CACHE_KEY = "__auto_detected_tenant__";

/**
 * Load CDN configuration from MongoDB homeSettings
 *
 * Uses caching to reduce database calls. Cache TTL is 1 minute.
 *
 * @returns CdnConfig if configured, null otherwise
 */
export async function getCdnConfig(tenantDb?: string): Promise<CdnConfig | null> {
  // Check cache first
  const now = Date.now();
  const cacheKey = tenantDb || AUTO_DETECTED_TENANT_CACHE_KEY;
  const cached = cachedConfigs.get(cacheKey);
  if (cached && now - cached.cachedAt < CONFIG_CACHE_TTL) {
    return cached.config;
  }

  try {
    const settings = await getHomeSettings(tenantDb);
    const creds = settings?.cdn_credentials as CDNCredentials | undefined;

    if (
      !creds?.cdn_url ||
      !creds?.bucket_region ||
      !creds?.bucket_name ||
      !creds?.cdn_key ||
      !creds?.cdn_secret
    ) {
      return null;
    }

    const config: CdnConfig = {
      endpoint: creds.cdn_url,
      region: creds.bucket_region,
      bucket: creds.bucket_name,
      accessKeyId: creds.cdn_key,
      secretAccessKey: creds.cdn_secret,
      folder: creds.folder_name,
      deleteEnabled: creds.delete_from_cloud ?? false,
    };
    cachedConfigs.set(cacheKey, { config, cachedAt: now });

    return config;
  } catch (error) {
    console.error("[cdn-config] Failed to load config from DB:", error);
    return null;
  }
}

/**
 * Check if CDN is configured
 */
export async function isCdnConfigured(tenantDb?: string): Promise<boolean> {
  const config = await getCdnConfig(tenantDb);
  return config !== null;
}

/**
 * Clear the CDN config cache
 *
 * Call this when CDN settings are updated in the admin panel.
 */
export function clearCdnConfigCache(tenantDb?: string): void {
  if (tenantDb) {
    cachedConfigs.delete(tenantDb);
    return;
  }

  cachedConfigs.clear();
}
