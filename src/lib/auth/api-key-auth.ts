/**
 * API Key Authentication Utilities
 *
 * Helper functions for authenticating requests using API keys.
 */

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getPooledConnection } from "@/lib/db/connection";
import type { IAPIKeyDocument, APIKeyPermission } from "@/lib/db/models/api-key";
import { trackApiCall } from "@/lib/services/api-usage.service";
import {
  checkRateLimit,
  getCachedTenantRateLimit,
  cacheTenantRateLimit,
  type TenantRateLimitSettings,
  type RateLimitResult,
} from "@/lib/services/tenant-rate-limit.service";
import { getTenantModel } from "@/lib/db/models/admin-tenant";

const BCRYPT_ROUNDS = 10;

/**
 * Extract tenant ID from API key format: "ak_{tenant-id}_{random}"
 */
export function extractTenantFromKeyId(keyId: string): string | null {
  // Match pattern: ak_{tenant-id}_{random}
  // Tenant ID can contain hyphens, so we match everything between first and last underscore
  const match = keyId.match(/^ak_(.+)_[a-f0-9]{12}$/);
  return match ? match[1] : null;
}

/**
 * Generate a new API key pair
 */
export function generateAPIKey(tenantId: string): { keyId: string; secret: string } {
  const random = randomBytes(6).toString("hex"); // 12 chars
  const keyId = `ak_${tenantId}_${random}`;
  const secret = `sk_${randomBytes(16).toString("hex")}`; // 32 chars
  return { keyId, secret };
}

/**
 * Hash an API secret for storage
 */
export async function hashAPISecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

/**
 * Verify an API key and secret
 */
export async function verifyAPIKey(
  keyId: string,
  secret: string
): Promise<{
  valid: boolean;
  tenantId?: string;
  permissions?: string[];
  keyDoc?: IAPIKeyDocument;
  error?: string;
}> {
  try {
    // 1. Extract tenant from key_id
    const tenantId = extractTenantFromKeyId(keyId);
    if (!tenantId) {
      return { valid: false, error: "Invalid API key format" };
    }

    // 2. Connect to tenant DB via connection pool
    const tenantDb = `vinc-${tenantId}`;
    const connection = await getPooledConnection(tenantDb);

    // 3. Query the apikeys collection directly from the pooled connection
    const keyDoc = await connection.db
      .collection("apikeys")
      .findOne({ key_id: keyId }) as IAPIKeyDocument | null;

    if (!keyDoc) {
      return { valid: false, error: "API key not found" };
    }

    // 4. Check if active
    if (!keyDoc.is_active) {
      return { valid: false, error: "API key is inactive" };
    }

    // 5. Verify secret with bcrypt
    const secretValid = await bcrypt.compare(secret, keyDoc.secret_hash);
    if (!secretValid) {
      return { valid: false, error: "Invalid API secret" };
    }

    // 6. Update last_used_at (non-blocking)
    connection.db
      .collection("apikeys")
      .updateOne({ _id: keyDoc._id }, { $set: { last_used_at: new Date() } })
      .catch(console.error);

    // 7. Track API usage (non-blocking)
    trackApiCall(tenantId, keyId).catch(() => {}); // Fire-and-forget

    // 8. Return success
    return {
      valid: true,
      tenantId,
      permissions: keyDoc.permissions,
      keyDoc,
    };
  } catch (error) {
    console.error("API key verification error:", error);
    return { valid: false, error: "Verification failed" };
  }
}

/**
 * Check if an API key has permission for a specific resource
 */
export function hasPermission(
  permissions: string[],
  requiredPermission: APIKeyPermission
): boolean {
  // Full access
  if (permissions.includes("*")) {
    return true;
  }

  // Specific permission
  return permissions.includes(requiredPermission);
}

/**
 * Verify API key and check permission in one call
 */
export async function verifyAPIKeyWithPermission(
  keyId: string,
  secret: string,
  requiredPermission: APIKeyPermission
): Promise<{
  valid: boolean;
  allowed: boolean;
  tenantId?: string;
  error?: string;
}> {
  const result = await verifyAPIKey(keyId, secret);

  if (!result.valid) {
    return { valid: false, allowed: false, error: result.error };
  }

  const allowed = hasPermission(result.permissions || [], requiredPermission);

  if (!allowed) {
    return {
      valid: true,
      allowed: false,
      tenantId: result.tenantId,
      error: `Insufficient permissions. Required: ${requiredPermission}`,
    };
  }

  return {
    valid: true,
    allowed: true,
    tenantId: result.tenantId,
  };
}

/**
 * Get rate limit settings for a tenant (with caching)
 */
async function getTenantRateLimitSettings(
  tenantId: string
): Promise<TenantRateLimitSettings | null> {
  // Check cache first
  const cached = await getCachedTenantRateLimit(tenantId);
  if (cached !== null) {
    return cached;
  }

  // Fetch from admin database (no retry needed - admin connection is isolated)
  try {
    const TenantModel = await getTenantModel();
    const tenant = await TenantModel.findByTenantId(tenantId);

    if (!tenant?.settings?.rate_limit) {
      // Cache the "no limit" state
      const noLimit: TenantRateLimitSettings = {
        enabled: false,
        requests_per_minute: 0,
        requests_per_day: 0,
        max_concurrent: 0,
      };
      await cacheTenantRateLimit(tenantId, noLimit);
      return noLimit;
    }

    const settings: TenantRateLimitSettings = {
      enabled: tenant.settings.rate_limit.enabled ?? false,
      requests_per_minute: tenant.settings.rate_limit.requests_per_minute ?? 0,
      requests_per_day: tenant.settings.rate_limit.requests_per_day ?? 0,
      max_concurrent: tenant.settings.rate_limit.max_concurrent ?? 0,
    };

    await cacheTenantRateLimit(tenantId, settings);
    return settings;
  } catch (error) {
    console.error("[Rate Limit] Failed to fetch tenant settings:", error);
    // On failure, allow the request (fail open)
    return null;
  }
}

/**
 * Verify API key authentication from request headers
 * Use this in route handlers when x-auth-method is "api-key"
 */
export async function verifyAPIKeyFromRequest(
  request: Request,
  requiredPermission?: APIKeyPermission
): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  error?: string;
  statusCode?: number;
  rateLimitInfo?: RateLimitResult["limits"];
}> {
  const authMethod = request.headers.get("x-auth-method");

  // Not using API key auth
  if (authMethod !== "api-key") {
    return { authenticated: false, error: "Not API key auth", statusCode: 401 };
  }

  const keyId = request.headers.get("x-api-key-id");
  const secret = request.headers.get("x-api-secret");

  if (!keyId || !secret) {
    return { authenticated: false, error: "Missing API credentials", statusCode: 401 };
  }

  // Verify the key and secret first
  let tenantId: string | undefined;

  if (requiredPermission) {
    const result = await verifyAPIKeyWithPermission(keyId, secret, requiredPermission);
    if (!result.valid) {
      return { authenticated: false, error: result.error, statusCode: 401 };
    }
    if (!result.allowed) {
      return { authenticated: false, error: result.error, statusCode: 403 };
    }
    tenantId = result.tenantId;
  } else {
    const result = await verifyAPIKey(keyId, secret);
    if (!result.valid) {
      return { authenticated: false, error: result.error, statusCode: 401 };
    }
    tenantId = result.tenantId;
  }

  // Check rate limit AFTER successful authentication
  if (tenantId) {
    const rateLimitSettings = await getTenantRateLimitSettings(tenantId);

    // Use API key as the client identifier for rate limiting
    const rateLimitResult = await checkRateLimit(tenantId, rateLimitSettings, keyId);

    if (!rateLimitResult.allowed) {
      const resetInfo = rateLimitResult.blocked_by === "minute"
        ? `Reset at: ${new Date(rateLimitResult.limits.minute.reset_at * 1000).toISOString()}`
        : rateLimitResult.blocked_by === "day"
        ? `Reset at: ${new Date(rateLimitResult.limits.day.reset_at * 1000).toISOString()}`
        : "Too many concurrent requests";

      return {
        authenticated: false,
        error: `Rate limit exceeded (${rateLimitResult.blocked_by}). ${resetInfo}`,
        statusCode: 429,
        rateLimitInfo: rateLimitResult.limits,
      };
    }
  }

  return {
    authenticated: true,
    tenantId,
    tenantDb: tenantId ? `vinc-${tenantId}` : undefined,
  };
}
