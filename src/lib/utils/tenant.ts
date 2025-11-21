/**
 * Tenant ID Extraction Utilities
 * Supports multiple methods for determining tenant from request
 */

import { NextRequest } from "next/server";

/**
 * Extract tenant ID from request
 * Priority order:
 * 1. X-Resolved-Tenant-ID (injected by middleware)
 * 2. X-Tenant-ID header
 * 3. Query parameter (?tenant=xxx)
 * 4. Subdomain (tenant-id.domain.com → tenant-id)
 * 5. Fall back to env var VINC_TENANT_ID
 */
export function getTenantIdFromRequest(request: NextRequest): string | null {
  // 1. Check resolved tenant ID from middleware (highest priority)
  const resolvedTenantId = request.headers.get("x-resolved-tenant-id");
  if (resolvedTenantId) {
    return resolvedTenantId;
  }

  // 2. Check X-Tenant-ID header
  const headerTenantId = request.headers.get("x-tenant-id");
  if (headerTenantId) {
    return headerTenantId;
  }

  // 3. Check query parameter
  const { searchParams } = new URL(request.url);
  const queryTenantId = searchParams.get("tenant");
  if (queryTenantId) {
    return queryTenantId;
  }

  // 4. Extract from subdomain
  const hostname = request.headers.get("host") || "";
  const subdomainTenantId = extractTenantFromSubdomain(hostname);
  if (subdomainTenantId) {
    return subdomainTenantId;
  }

  // 5. Fall back to environment variable
  return process.env.VINC_TENANT_ID || null;
}

/**
 * Extract tenant ID from subdomain
 * Examples:
 * - hidros-it.localhost → hidros-it
 * - hidros-it.example.com → hidros-it
 * - localhost → null
 * - example.com → null
 */
function extractTenantFromSubdomain(hostname: string): string | null {
  // Remove port if present
  const hostnameWithoutPort = hostname.split(":")[0];

  // Split by dots
  const parts = hostnameWithoutPort.split(".");

  // If we have at least 2 parts (subdomain.domain or subdomain.localhost)
  // and the first part is not 'www', treat it as tenant ID
  if (parts.length >= 2 && parts[0] !== "www") {
    return parts[0];
  }

  return null;
}

/**
 * Build tenant-specific database name
 * @param tenantId - The tenant identifier
 * @returns Database name in format: vinc-{tenantId}
 */
export function getTenantDatabaseName(tenantId: string): string {
  return `vinc-${tenantId}`;
}

/**
 * Get tenant database name from request
 * Convenience function that combines getTenantIdFromRequest and getTenantDatabaseName
 */
export function getTenantDbFromRequest(request: NextRequest): string | null {
  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return null;
  }
  return getTenantDatabaseName(tenantId);
}
