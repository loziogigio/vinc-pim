import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, type Model } from "mongoose";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission } from "@/lib/api/require-permission";
import { connectWithModels } from "@/lib/db/connection";
import { isPriceAccess, priceAccessRank, type PriceAccess } from "@/lib/auth/permissions/price-access";
import { isPermissionKey } from "@/lib/auth/permissions/catalog";
import type { ScopeValues } from "@/lib/auth/permissions/scope";
import { __clearAuthzCache, legacyRoleGrant } from "@/lib/auth/authorization";

const SAFE_FIELDS = "username email role role_id scope_values price_access isActive companyName lastLoginAt createdAt updatedAt";

const notFound = () => NextResponse.json({ error: "User not found" }, { status: 404 });
const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });

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
  if (!isValidObjectId(id)) return notFound();
  const { B2BUser } = await connectWithModels(auth.tenantDb);
  const user = await B2BUser.findById(id).select(SAFE_FIELDS).lean();
  if (!user) return notFound();
  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "users.manage");
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return notFound();
  const { B2BUser, Role } = await connectWithModels(auth.tenantDb);
  const user = await B2BUser.findById(id);
  if (!user) return notFound();

  // Capture the pre-change identity for the lockout guard below.
  const before = { roleId: user.role_id as string | undefined, legacyRole: user.role as string | undefined, isActive: user.isActive as boolean };

  const body = await req.json().catch(() => ({}));

  // Self-elevation / self-lockout guards: a user may never change their OWN
  // role, price access, or deactivate themselves through this route — an admin
  // manages OTHER users' privileges, not their own (idor-2). Re-sending the
  // unchanged current value is a no-op and allowed.
  const isSelf = auth.userId != null && user._id.toString() === auth.userId;
  if (isSelf) {
    if (rolesChange(body, user.role_id)) return forbidden("You cannot change your own role");
    if (priceChange(body, user.price_access)) return forbidden("You cannot change your own price access");
    if (body.isActive === false) return forbidden("You cannot deactivate yourself");
  }

  if (body.role_id !== undefined) {
    if (body.role_id === null || body.role_id === "") {
      // Clearing role_id falls back to the legacy `role` field. Apply the same
      // ceiling so a low-privilege caller can't expose a higher legacy role on
      // the target (authz-3).
      const legacy = legacyRoleGrant(user.role);
      if (legacy.permissions.some((p) => !auth.permissions.has(p))) {
        return forbidden("You cannot remove a role in a way that grants permissions you do not hold");
      }
      if (priceAccessRank(legacy.priceAccess) > priceAccessRank(auth.priceAccess)) {
        return forbidden("You cannot remove a role in a way that grants higher price access than your own");
      }
      user.role_id = undefined;
    } else {
      const role = await Role.findOne({ role_id: body.role_id, is_active: true })
        .lean<{ permissions: string[]; price_access?: PriceAccess } | null>();
      if (!role) return NextResponse.json({ error: "Unknown role_id" }, { status: 400 });
      // No-escalation ceiling: the assigned role may not carry a permission the
      // caller lacks, nor a higher price access than the caller's own.
      const rolePerms = role.permissions.filter(isPermissionKey);
      if (rolePerms.some((p) => !auth.permissions.has(p))) {
        return forbidden("You cannot assign a role with permissions you do not hold");
      }
      if (priceAccessRank(role.price_access ?? "none") > priceAccessRank(auth.priceAccess)) {
        return forbidden("You cannot assign a role with higher price access than your own");
      }
      user.role_id = body.role_id;
    }
  }
  if (body.scope_values && typeof body.scope_values === "object") {
    const requested: ScopeValues = {
      channels: scopeDim(body.scope_values.channels),
      customers: scopeDim(body.scope_values.customers),
      price_lists: scopeDim(body.scope_values.price_lists),
    };
    // No-escalation ceiling: cannot grant a broader scope than the caller's own
    // on any dimension (authz-4).
    if (!scopeWithinCeiling(requested, auth.scope)) {
      return forbidden("You cannot grant a broader scope than your own");
    }
    user.scope_values = requested;
  }
  if (body.price_access === null || body.price_access === "") {
    user.price_access = undefined; // inherit role
  } else if (isPriceAccess(body.price_access)) {
    // No-escalation ceiling: cannot grant a price access above the caller's own.
    if (priceAccessRank(body.price_access) > priceAccessRank(auth.priceAccess)) {
      return forbidden("You cannot grant price access higher than your own");
    }
    user.price_access = body.price_access;
  }
  if (typeof body.isActive === "boolean") user.isActive = body.isActive;

  // Lockout guard: never let the LAST active roles.manage holder lose that
  // status (idor-2). Self-lockout is already blocked above; this covers
  // deactivating or de-roling ANOTHER user who is the sole role-admin.
  if (body.isActive === false || body.role_id !== undefined) {
    const wasRoleAdmin = before.isActive && (await holdsRolesManage(Role, before.roleId, before.legacyRole));
    const stillRoleAdmin = user.isActive && (await holdsRolesManage(Role, user.role_id, user.role));
    if (wasRoleAdmin && !stillRoleAdmin) {
      const others = await countOtherActiveRoleAdmins(B2BUser, Role, user._id);
      if (others === 0) return forbidden("You cannot remove the last active user who can manage roles");
    }
  }

  await user.save();
  // This user's effective permissions/scope changed → drop cached authorizations.
  __clearAuthzCache();
  const safe = await B2BUser.findById(id).select(SAFE_FIELDS).lean();
  return NextResponse.json({ success: true, data: safe });
}

/** True when the body would change role_id away from its current value. */
function rolesChange(body: Record<string, unknown>, current: string | undefined): boolean {
  if (body.role_id === undefined) return false;
  const requested = body.role_id === null || body.role_id === "" ? undefined : body.role_id;
  return requested !== (current ?? undefined);
}

/** True when the body would change the price_access override from its current value. */
function priceChange(body: Record<string, unknown>, current: PriceAccess | undefined): boolean {
  if (body.price_access === undefined) return false;
  const requested = body.price_access === null || body.price_access === "" ? undefined : body.price_access;
  return requested !== (current ?? undefined);
}

/** A requested scope is within the caller's ceiling when every dimension is no
 *  broader than the caller's. "all" is the broadest; a list is bounded by the
 *  caller's list (or unbounded when the caller holds "all"). */
function scopeWithinCeiling(requested: ScopeValues, caller: ScopeValues): boolean {
  return (Object.keys(requested) as (keyof ScopeValues)[]).every((dim) =>
    dimWithinCeiling(requested[dim], caller[dim])
  );
}
function dimWithinCeiling(requested: "all" | string[], caller: "all" | string[]): boolean {
  if (caller === "all") return true; // caller unrestricted → may grant anything
  if (requested === "all") return false; // caller restricted → cannot grant "all"
  return requested.every((v) => caller.includes(v));
}

/** Whether a user identified by (role_id | legacy role) effectively holds
 *  roles.manage. role_id takes precedence over the legacy `role` field. */
async function holdsRolesManage(Role: Model<any>, roleId: string | undefined, legacyRole: string | undefined): Promise<boolean> {
  if (roleId) {
    const role = await Role.findOne({ role_id: roleId, is_active: true }).lean<{ permissions: string[] } | null>();
    return !!role && role.permissions.includes("roles.manage");
  }
  return legacyRoleGrant(legacyRole).permissions.includes("roles.manage");
}

/** Count active staff OTHER than `excludeId` who effectively hold roles.manage
 *  (via an active role carrying it, or the legacy `role: "admin"` fallback). */
async function countOtherActiveRoleAdmins(B2BUser: Model<any>, Role: Model<any>, excludeId: unknown): Promise<number> {
  const adminRoles = await Role.find({ is_active: true, permissions: "roles.manage" }).select("role_id").lean<{ role_id: string }[]>();
  const adminRoleIds = adminRoles.map((r) => r.role_id);
  return B2BUser.countDocuments({
    _id: { $ne: excludeId },
    isActive: true,
    $or: [
      { role_id: { $in: adminRoleIds } },
      { role_id: null, role: "admin" }, // legacy admin (no role_id) maps to the all-perms preset
    ],
  });
}
