import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission, requireAnyPermission } from "@/lib/api/require-permission";
import { connectWithModels } from "@/lib/db/connection";
import { ensureSystemRoles } from "@/lib/auth/permissions/seed-system-roles";
import { isPermissionKey } from "@/lib/auth/permissions/catalog";
import { isPriceAccess } from "@/lib/auth/permissions/price-access";
import { sanitizeScope } from "@/lib/auth/permissions/scope";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requireAnyPermission(auth, ["roles.manage", "users.manage"]);
  if (denied) return denied;

  await ensureSystemRoles(auth.tenantDb);
  const { Role } = await connectWithModels(auth.tenantDb);
  const items = await Role.find({ is_active: true }).sort({ is_system: -1, name: 1 }).lean();
  return NextResponse.json({ success: true, data: { items } });
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "roles.manage");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p: string) => isPermissionKey(p)) : [];
  const price_access = isPriceAccess(body.price_access) ? body.price_access : "none";

  const { Role } = await connectWithModels(auth.tenantDb);
  const created = await Role.create({
    name,
    description: typeof body.description === "string" ? body.description.trim() : undefined,
    is_system: false,
    permissions,
    scope: sanitizeScope(body.scope),
    price_access,
    is_active: true,
  });
  return NextResponse.json({ success: true, data: created.toObject() }, { status: 201 });
}
