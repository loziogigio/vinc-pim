import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";

/**
 * Resolve the tenant database for a PUBLIC blog read.
 *
 * Two accepted paths (in order):
 *   1. `x-resolved-tenant-db` header — legacy proxy path, injected by an edge
 *      layer; used verbatim, no auth (unchanged behaviour).
 *   2. `x-api-key-id` + `x-api-secret` headers → `verifyAPIKey` → `vinc-${tenantId}`.
 *      This is what makes office's per-store proxy reads safe when no edge
 *      injector is active.
 *
 * Returns `{ tenantDb }` on success or `{ response }` carrying a 401 to return.
 */
export async function resolvePublicBlogTenant(
  req: NextRequest,
): Promise<{ tenantDb: string } | { response: NextResponse }> {
  const resolved = req.headers.get("x-resolved-tenant-db");
  if (resolved) return { tenantDb: resolved };

  const keyId = req.headers.get("x-api-key-id");
  const secret = req.headers.get("x-api-secret");
  if (!keyId || !secret) {
    return { response: NextResponse.json({ error: "Missing API key credentials" }, { status: 401 }) };
  }

  const authResult = await verifyAPIKey(keyId, secret);
  if (!authResult.valid || !authResult.tenantId) {
    return { response: NextResponse.json({ error: authResult.error || "Invalid API key" }, { status: 401 }) };
  }

  return { tenantDb: `vinc-${authResult.tenantId}` };
}
