/**
 * Test helper: buildAuthedRequest / buildPublicRequest
 *
 * buildAuthedRequest — builds a NextRequest pre-populated with tenant-auth
 * headers so that vi.mock("@/lib/auth/tenant-auth") can be set up to return
 * the correct tenant context.  Callers must still mock requireTenantAuth
 * themselves — the helper just creates a consistent request shape.
 *
 * buildPublicRequest — builds a NextRequest pre-populated with API-key
 * headers so that vi.mock("@/lib/auth/api-key-auth") can be set up to
 * return the correct tenant context.  Used for public routes that authenticate
 * via verifyAPIKey (x-api-key-id / x-api-secret) rather than requireTenantAuth.
 */

import { NextRequest } from "next/server";

/**
 * Build a NextRequest that looks like an authenticated admin request
 * for the given tenant.
 *
 * @param method  HTTP method
 * @param url     Path (will be prefixed with http://localhost)
 * @param tenantId  Tenant ID (used to compute tenantDb = `vinc-${tenantId}`)
 * @param body    Optional JSON body
 */
export function buildAuthedRequest(
  method: string,
  url: string,
  tenantId: string,
  body?: unknown
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
  return new NextRequest(fullUrl, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      // Minimal header set so requireTenantAuth mock can be targeted
      "x-tenant-id": tenantId,
    },
  });
}

/**
 * Build a NextRequest that looks like a public API-key-authenticated request.
 *
 * The headers (x-api-key-id / x-api-secret) are sentinel values that tests
 * can use together with vi.mock("@/lib/auth/api-key-auth") to control what
 * verifyAPIKey returns.  The helper does NOT set up the mock — callers are
 * responsible for that.
 *
 * @param method    HTTP method
 * @param url       Path or full URL (prefixed with http://localhost if relative)
 * @param tenantId  Tenant ID embedded in the sentinel key-id
 * @param body      Optional JSON body
 */
export function buildPublicRequest(
  method: string,
  url: string,
  tenantId: string,
  body?: unknown
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
  return new NextRequest(fullUrl, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "x-api-key-id": `ak_${tenantId}_test`,
      "x-api-secret": `sk_test_secret`,
    },
  });
}
