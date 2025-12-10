import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Buffer } from "node:buffer";
import { getHomeSettings } from "@/lib/db/home-settings";
import type { CDNCredentials } from "@/lib/types/home-settings";

/**
 * CDN Configuration for upload operations
 */
type CdnUploadConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  access_key_id: string;
  secret_access_key: string;
  folder?: string;
  delete_from_cloud?: boolean;
};

// Cache for CDN config to avoid repeated DB calls
let cachedConfig: CdnUploadConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load CDN configuration from MongoDB homeSettings
 */
const loadConfigFromDB = async (): Promise<CdnUploadConfig | null> => {
  try {
    const settings = await getHomeSettings();
    const creds = settings?.cdn_credentials as CDNCredentials | undefined;

    if (!creds?.cdn_url || !creds?.bucket_region || !creds?.bucket_name || !creds?.cdn_key || !creds?.cdn_secret) {
      return null;
    }

    return {
      endpoint: creds.cdn_url,
      region: creds.bucket_region,
      bucket: creds.bucket_name,
      access_key_id: creds.cdn_key,
      secret_access_key: creds.cdn_secret,
      folder: creds.folder_name,
      delete_from_cloud: creds.delete_from_cloud ?? false
    };
  } catch (error) {
    console.error("[cdn-upload] Failed to load config from DB:", error);
    return null;
  }
};

/**
 * Get CDN configuration from MongoDB homeSettings
 */
export const getCdnConfig = async (): Promise<CdnUploadConfig | null> => {
  // Check cache first
  const now = Date.now();
  if (cachedConfig && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  // Load from MongoDB
  const dbConfig = await loadConfigFromDB();
  if (dbConfig) {
    cachedConfig = dbConfig;
    configCacheTime = now;
    return dbConfig;
  }

  return null;
};

/**
 * Clear the CDN config cache (useful when settings are updated)
 */
export const clearCdnConfigCache = () => {
  cachedConfig = null;
  configCacheTime = 0;
};

/**
 * Check if CDN is configured
 */
export const isCdnConfigured = async (): Promise<boolean> => {
  const config = await getCdnConfig();
  return config !== null;
};

/**
 * Create S3 client from config
 */
const createS3Client = (config: CdnUploadConfig): S3Client => {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint.startsWith("http")
      ? config.endpoint
      : `https://${config.endpoint}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key
    }
  });
};

/**
 * Sanitize filename for CDN storage
 */
const sanitizeFilename = (fileName: string): string =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Build object key with folder prefix and timestamp
 */
const buildObjectKey = (fileName: string, folder?: string): string => {
  const sanitized = sanitizeFilename(fileName);
  const folderPrefix = folder ? `${folder.replace(/\/+$/, "")}/` : "";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${folderPrefix}${timestamp}-${sanitized}`;
};

type UploadParams = {
  buffer: Buffer;
  content_type: string;
  file_name: string;
  custom_folder?: string;
};

type UploadResult = {
  key: string;
  url: string;
};

/**
 * Upload file to CDN
 */
export const uploadToCdn = async ({
  buffer,
  content_type,
  file_name,
  custom_folder
}: UploadParams): Promise<UploadResult> => {
  const config = await getCdnConfig();
  if (!config) {
    throw new Error("CDN is not configured");
  }

  const client = createS3Client(config);
  const folder = custom_folder ?? config.folder;
  const key = buildObjectKey(file_name, folder);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: content_type,
      ACL: "public-read"
    })
  );

  const normalizedEndpoint = config.endpoint.startsWith("http")
    ? config.endpoint.replace(/\/+$/, "")
    : `https://${config.endpoint.replace(/\/+$/, "")}`;

  return {
    key,
    url: `${normalizedEndpoint}/${config.bucket}/${key}`
  };
};

/**
 * Delete file from CDN (only if delete_from_cloud is enabled)
 */
export const deleteFromCdn = async (key: string): Promise<boolean> => {
  const config = await getCdnConfig();
  if (!config) {
    console.warn("[cdn-upload] CDN not configured, cannot delete");
    return false;
  }

  if (!config.delete_from_cloud) {
    console.log("[cdn-upload] delete_from_cloud is disabled, skipping CDN deletion");
    return false;
  }

  try {
    const client = createS3Client(config);
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key
      })
    );
    console.log("[cdn-upload] Deleted from CDN:", key);
    return true;
  } catch (error) {
    console.error("[cdn-upload] Failed to delete from CDN:", error);
    return false;
  }
};

/**
 * Get the CDN base URL for constructing URLs
 */
export const getCdnBaseUrl = async (): Promise<string> => {
  const config = await getCdnConfig();
  if (!config) {
    return "";
  }

  const normalizedEndpoint = config.endpoint.startsWith("http")
    ? config.endpoint.replace(/\/+$/, "")
    : `https://${config.endpoint.replace(/\/+$/, "")}`;

  return `${normalizedEndpoint}/${config.bucket}`;
};
