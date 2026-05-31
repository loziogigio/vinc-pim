import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission } from "@/lib/api/require-permission";
import { ensureSystemRoles } from "@/lib/auth/permissions/seed-system-roles";
import { __clearAuthzCache } from "@/lib/auth/authorization";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "roles.manage");
  if (denied) return denied;
  await ensureSystemRoles(auth.tenantDb);
  // System-role permissions may have been reset → drop cached authorizations.
  __clearAuthzCache();
  return NextResponse.json({ success: true, data: { restored: true } });
}
