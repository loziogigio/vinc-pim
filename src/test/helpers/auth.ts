/**
 * Test helper: buildAuthedRequest
 *
 * Builds a NextRequest pre-populated with tenant-auth headers so that
 * vi.mock("@/lib/auth/tenant-auth") can be set up to return the correct
 * tenant context.  Callers must still mock requireTenantAuth themselves —
 * the helper just creates a consistent request shape.
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
