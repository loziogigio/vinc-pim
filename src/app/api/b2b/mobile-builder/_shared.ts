/**
 * Shared helpers for the mobile-builder API routes.
 *
 * Auth is intentionally NOT migrated to `requireTenantAuth`: the existing
 * `verifyAPIKeyFromRequest(req, scope)` path enforces both API-key permission
 * scope and per-tenant rate limiting, neither of which `requireTenantAuth`
 * applies today. Migrating would silently relax write-endpoint security.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

export type MobileBuilderAuth =
  | { tenantDb: string; userId: string | undefined; error?: undefined }
  | { error: NextResponse };

export async function resolveMobileBuilderAuth(
  req: NextRequest,
  scope: "read" | "write"
): Promise<MobileBuilderAuth> {
  if (req.headers.get("x-auth-method") === "api-key") {
    const r = await verifyAPIKeyFromRequest(req, scope);
    if (!r.authenticated) {
      return {
        error: NextResponse.json(
          { error: r.error || "Unauthorized" },
          { status: r.statusCode || 401 }
        ),
      };
    }
    return { tenantDb: r.tenantDb!, userId: `api-key:${r.keyId}` };
  }
  const session = await getB2BSession();
  if (!session?.tenantId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { tenantDb: `vinc-${session.tenantId}`, userId: session.user?.id };
}
