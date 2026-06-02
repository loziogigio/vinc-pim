import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";

/**
 * GET /api/b2b/me
 * Returns the authenticated user's resolved authorization context so the client
 * can drive permission-aware UI without re-login (permissions are NOT in the JWT).
 */
export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  return NextResponse.json({
    success: true,
    data: {
      tenantId: auth.tenantId,
      userId: auth.userId ?? null,
      email: auth.email ?? null,
      userType: auth.userType ?? null,
      permissions: [...auth.permissions],
      entitledApps: auth.entitledApps ?? null,
      scope: auth.scope,
    },
  });
}
