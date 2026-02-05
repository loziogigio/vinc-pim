/**
 * CDN Configuration Adapter
 *
 * Loads CDN configuration from MongoDB homeSettings and transforms it
 * to the format expected by the vinc-cdn package.
 */

import type { CdnConfig } from "vinc-cdn";
import { getHomeSettings } from "@/lib/db/home-settings";
import type { CDNCredentials } from "@/lib/types/home-settings";

// Cache for CDN config to avoid repeated DB calls
let cachedConfig: CdnConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load CDN configuration from MongoDB homeSettings
 *
 * Uses caching to reduce database calls. Cache TTL is 1 minute.
 *
 * @returns CdnConfig if configured, null otherwise
 */
export async function getCdnConfig(): Promise<CdnConfig | null> {
  // Check cache first
  const now = Date.now();
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const settings = await getHomeSettings();
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

    cachedConfig = {
      endpoint: creds.cdn_url,
      region: creds.bucket_region,
      bucket: creds.bucket_name,
      accessKeyId: creds.cdn_key,
      secretAccessKey: creds.cdn_secret,
      folder: creds.folder_name,
      deleteEnabled: creds.delete_from_cloud ?? false,
    };
    configCacheTime = now;

    return cachedConfig;
  } catch (error) {
    console.error("[cdn-config] Failed to load config from DB:", error);
    return null;
  }
}

/**
 * Check if CDN is configured
 */
export async function isCdnConfigured(): Promise<boolean> {
  const config = await getCdnConfig();
  return config !== null;
}

/**
 * Clear the CDN config cache
 *
 * Call this when CDN settings are updated in the admin panel.
 */
export function clearCdnConfigCache(): void {
  cachedConfig = null;
  configCacheTime = 0;
}
