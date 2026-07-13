import type { CdnConfig } from "vinc-cdn";

export const MAX_PORTAL_SCRIPT_SIZE_BYTES = 1024 * 1024;

export const ALLOWED_PORTAL_SCRIPT_EXTENSIONS = ["js"] as const;

export const ALLOWED_PORTAL_SCRIPT_MIME_TYPES = [
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
] as const;

type PortalScriptFile = Pick<File, "name" | "size" | "type">;

export type PortalScriptValidationResult =
  | { valid: true; contentType: "text/javascript" }
  | { valid: false; error: string };

/**
 * Validate JavaScript assets before they reach tenant CDN storage.
 * Both the extension and browser-provided MIME type must identify JavaScript.
 */
export function validatePortalScriptFile(
  file: PortalScriptFile,
): PortalScriptValidationResult {
  if (file.size === 0) {
    return { valid: false, error: "JavaScript file is empty" };
  }

  if (file.size > MAX_PORTAL_SCRIPT_SIZE_BYTES) {
    return {
      valid: false,
      error: `JavaScript file exceeds the ${MAX_PORTAL_SCRIPT_SIZE_BYTES / (1024 * 1024)}MB limit`,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!(ALLOWED_PORTAL_SCRIPT_EXTENSIONS as readonly string[]).includes(extension)) {
    return { valid: false, error: "Only .js files are allowed" };
  }

  const mimeType = file.type.toLowerCase().split(";", 1)[0].trim();
  if (!(ALLOWED_PORTAL_SCRIPT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return {
      valid: false,
      error: "File MIME type must be JavaScript",
    };
  }

  // Use the standards-based type consistently when the CDN serves the asset.
  return { valid: true, contentType: "text/javascript" };
}

function sanitizeFolderSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFolderPath(value: string | undefined): string | undefined {
  const sanitized = value
    ?.split("/")
    .map(sanitizeFolderSegment)
    .filter(Boolean)
    .join("/");
  return sanitized || undefined;
}

/** Build an object prefix that cannot escape its authenticated tenant/portal. */
export function buildPortalScriptFolder(
  configFolder: string | undefined,
  tenantId: string,
  portalSlug: string,
): string {
  const baseFolder = sanitizeFolderPath(configFolder);
  const tenantSegment = sanitizeFolderSegment(tenantId) || "tenant";
  const portalSegment = sanitizeFolderSegment(portalSlug) || "portal";

  return [
    baseFolder,
    "b2b",
    tenantSegment,
    "portals",
    portalSegment,
    "scripts",
  ]
    .filter(Boolean)
    .join("/");
}

/** vinc-cdn builds public URLs from the configured endpoint. */
export function hasSecureCdnEndpoint(config: CdnConfig): boolean {
  try {
    const endpoint = config.endpoint.includes("://")
      ? config.endpoint
      : `https://${config.endpoint}`;
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

export function isHttpsAssetUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
