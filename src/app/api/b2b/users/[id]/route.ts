import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission } from "@/lib/api/require-permission";
import { connectWithModels } from "@/lib/db/connection";
import { isPriceAccess } from "@/lib/auth/permissions/price-access";
import { __clearAuthzCache } from "@/lib/auth/authorization";

const SAFE_FIELDS = "username email role role_id scope_values price_access isActive companyName lastLoginAt createdAt updatedAt";

/** Normalize one scope dimension to "all" | string[]. */
function scopeDim(v: unknown): "all" | string[] {
  return Array.isArray(v) ? v.map(String) : "all";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "users.manage");
  if (denied) return denied;
  const { id } = await params;
  const { B2BUser } = await connectWithModels(auth.tenantDb);
  const user = await B2BUser.findById(id).select(SAFE_FIELDS).lean();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "users.manage");
  if (denied) return denied;
  const { id } = await params;
  const { B2BUser, Role } = await connectWithModels(auth.tenantDb);
  const user = await B2BUser.findById(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.role_id !== undefined) {
    if (body.role_id === null || body.role_id === "") {
      user.role_id = undefined;
    } else {
      const role = await Role.findOne({ role_id: body.role_id, is_active: true }).lean();
      if (!role) return NextResponse.json({ error: "Unknown role_id" }, { status: 400 });
      user.role_id = body.role_id;
    }
  }
  if (body.scope_values && typeof body.scope_values === "object") {
    user.scope_values = {
      channels: scopeDim(body.scope_values.channels),
      customers: scopeDim(body.scope_values.customers),
      price_lists: scopeDim(body.scope_values.price_lists),
    };
  }
  if (body.price_access === null || body.price_access === "") {
    user.price_access = undefined; // inherit role
  } else if (isPriceAccess(body.price_access)) {
    user.price_access = body.price_access;
  }
  if (typeof body.isActive === "boolean") user.isActive = body.isActive;

  await user.save();
  // This user's effective permissions/scope changed → drop cached authorizations.
  __clearAuthzCache();
  const safe = await B2BUser.findById(id).select(SAFE_FIELDS).lean();
  return NextResponse.json({ success: true, data: safe });
}
