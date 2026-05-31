import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission, requireAnyPermission } from "@/lib/api/require-permission";
import { connectWithModels } from "@/lib/db/connection";
import { isPermissionKey } from "@/lib/auth/permissions/catalog";
import { isPriceAccess } from "@/lib/auth/permissions/price-access";
import { __clearAuthzCache } from "@/lib/auth/authorization";
import type { RoleScope } from "@/lib/auth/permissions/scope";

function sanitizeScope(input: unknown): RoleScope {
  const s = (input ?? {}) as Record<string, unknown>;
  const dim = (v: unknown): "all" | "per_user" => (v === "per_user" ? "per_user" : "all");
  return { channels: dim(s.channels), customers: dim(s.customers), price_lists: dim(s.price_lists) };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requireAnyPermission(auth, ["roles.manage", "users.manage"]);
  if (denied) return denied;
  const { id } = await params;
  const { Role } = await connectWithModels(auth.tenantDb);
  const role = await Role.findOne({ role_id: id }).lean();
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: role });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "roles.manage");
  if (denied) return denied;
  const { id } = await params;
  const { Role } = await connectWithModels(auth.tenantDb);
  const role = await Role.findOne({ role_id: id });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.is_system) return NextResponse.json({ error: "System roles cannot be edited" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    role.name = name;
  }
  if (typeof body.description === "string") role.description = body.description.trim();
  if (Array.isArray(body.permissions)) role.permissions = body.permissions.filter((p: string) => isPermissionKey(p));
  if (body.scope) role.scope = sanitizeScope(body.scope);
  if (isPriceAccess(body.price_access)) role.price_access = body.price_access;
  await role.save();
  // A role's permissions changed → drop cached authorizations so assigned users see it immediately.
  __clearAuthzCache();
  return NextResponse.json({ success: true, data: role.toObject() });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "roles.manage");
  if (denied) return denied;
  const { id } = await params;
  const { Role, B2BUser } = await connectWithModels(auth.tenantDb);
  const role = await Role.findOne({ role_id: id });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.is_system) return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 403 });

  const inUse = await B2BUser.countDocuments({ role_id: id });
  if (inUse > 0) return NextResponse.json({ error: `Role is assigned to ${inUse} user(s)` }, { status: 409 });

  role.is_active = false;
  await role.save();
  return NextResponse.json({ success: true, data: { role_id: id } });
}
