/**
 * Cache Clear Service
 *
 * Notifies vinc-b2b instances to clear their tenant cache when tenant
 * configuration is updated in vinc-commerce-suite.
 */

import crypto from "crypto";
import { getAdminTokenModel } from "../db/models/admin-token";
import { getTenantModel } from "../db/models/admin-tenant";

interface NotifyCacheOptions {
  tenantId: string;
  timeout?: number;
}

interface NotifyResult {
  url: string;
  success: boolean;
}

// Token refresh interval (30 days in milliseconds)
const TOKEN_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate a secure random token.
 */
function generateSecureToken(): string {
  return `cct_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Get or create an active admin token for cache notifications.
 * Auto-creates token if none exists, auto-refreshes if older than 30 days.
 */
export async function getAdminToken(): Promise<string | null> {
  try {
    const AdminToken = await getAdminTokenModel();

    // Find active, non-expired token
    let tokenDoc = await AdminToken.findOne({
      is_active: true,
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
    });

    const now = new Date();

    // Check if token needs refresh (older than 30 days)
    if (tokenDoc) {
      const tokenAge = now.getTime() - new Date(tokenDoc.created_at).getTime();
      if (tokenAge > TOKEN_REFRESH_INTERVAL_MS) {
        console.log("[CacheClear] Token is older than 30 days, refreshing...");
        // Deactivate old token
        tokenDoc.is_active = false;
        await tokenDoc.save();
        tokenDoc = null;
      }
    }

    // Auto-create token if none exists
    if (!tokenDoc) {
      const newToken = generateSecureToken();
      tokenDoc = await AdminToken.create({
        token: newToken,
        description: "Auto-generated cache clear token",
        is_active: true,
        expires_at: null,
        created_by: "system",
      });
      console.log("[CacheClear] Auto-created new admin token");
    }

    return tokenDoc.token;
  } catch (error) {
    console.error("[CacheClear] Failed to get/create admin token:", error);
    return null;
  }
}

/**
 * Notify all tenant b2b URLs to clear their cache.
 * This is a "fire and forget" operation - failures are logged but don't throw.
 */
export async function notifyTenantCacheClear(
  options: NotifyCacheOptions
): Promise<void> {
  const { tenantId, timeout = 5000 } = options;

  // Get admin token
  const adminToken = await getAdminToken();
  if (!adminToken) {
    console.warn(
      "[CacheClear] No active admin token found, skipping notification"
    );
    return;
  }

  // Get tenant to find b2b URLs
  const TenantModel = await getTenantModel();
  const tenant = await TenantModel.findOne({ tenant_id: tenantId }).lean();

  if (!tenant) {
    console.warn(`[CacheClear] Tenant ${tenantId} not found`);
    return;
  }

  // Build list of URLs to notify
  const urls: string[] = [];

  // Add URLs from domains array
  if (tenant.domains && tenant.domains.length > 0) {
    for (const domain of tenant.domains) {
      if (domain.is_active !== false && domain.hostname) {
        // Use domain's configured protocol, fallback to https (http for localhost)
        const protocol = domain.protocol || (domain.hostname.includes("localhost") ? "http" : "https");
        urls.push(`${protocol}://${domain.hostname}`);
      }
    }
  }


  if (urls.length === 0) {
    console.log(`[CacheClear] No active URLs for tenant ${tenantId}`);
    return;
  }

  console.log(
    `[CacheClear] Notifying ${urls.length} URL(s) for tenant ${tenantId}`
  );

  // Notify all URLs in parallel
  const results = await Promise.allSettled(
    urls.map(async (baseUrl): Promise<NotifyResult> => {
      const endpoint = `${baseUrl}/api/admin/clear-tenant-cache`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": adminToken,
          },
          body: JSON.stringify({ tenantId }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return { url: baseUrl, success: true };
      } catch (error) {
        clearTimeout(timeoutId);
        throw new Error(
          `${baseUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    })
  );

  // Log results
  for (const result of results) {
    if (result.status === "fulfilled") {
      console.log(`[CacheClear] ✓ ${result.value.url}`);
    } else {
      console.warn(`[CacheClear] ✗ ${result.reason}`);
    }
  }
}
