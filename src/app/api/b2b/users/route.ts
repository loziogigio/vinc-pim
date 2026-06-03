import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission } from "@/lib/api/require-permission";
import { connectWithModels } from "@/lib/db/connection";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { sendWelcomeEmail } from "@/lib/email/b2b-emails";
import { isPriceAccess, priceAccessRank, type PriceAccess } from "@/lib/auth/permissions/price-access";
import { isPermissionKey } from "@/lib/auth/permissions/catalog";
import type { ScopeValues } from "@/lib/auth/permissions/scope";

const SAFE_FIELDS = "username email role role_id scope_values price_access isActive companyName lastLoginAt createdAt updatedAt";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "users.manage");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = (searchParams.get("search") || "").trim();

  const query: Record<string, unknown> = {};
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ username: rx }, { email: rx }, { companyName: rx }];
  }

  const { B2BUser } = await connectWithModels(auth.tenantDb);
  const [items, total] = await Promise.all([
    B2BUser.find(query).select(SAFE_FIELDS).sort({ username: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    B2BUser.countDocuments(query),
  ]);
  return NextResponse.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
}

/** "all" | string[] normalizer for one scope dimension. */
function scopeDim(v: unknown): "all" | string[] {
  return Array.isArray(v) ? v.map(String) : "all";
}
function dimWithinCeiling(requested: "all" | string[], caller: "all" | string[]): boolean {
  if (caller === "all") return true;
  if (requested === "all") return false;
  return requested.every((x) => caller.includes(x));
}
function scopeWithinCeiling(requested: ScopeValues, caller: ScopeValues): boolean {
  return (Object.keys(requested) as (keyof ScopeValues)[]).every((d) => dimWithinCeiling(requested[d], caller[d]));
}

/** A readable temporary password: 16 url-safe chars. */
function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const denied = requirePermission(auth, "users.manage");
  if (denied) return denied;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const companyName = typeof body.companyName === "string" && body.companyName.trim()
    ? body.companyName.trim()
    : (auth.tenantId ?? "Team");

  if (username.length < 3 || !email) {
    return NextResponse.json({ error: "username (min 3) and email are required" }, { status: 400 });
  }

  const { B2BUser, Role } = await connectWithModels(auth.tenantDb);

  if (await B2BUser.findOne({ $or: [{ username }, { email }] }).lean()) {
    return NextResponse.json({ error: "A user with this username or email already exists" }, { status: 409 });
  }

  // Resolve and ceiling-check the assigned role (no privilege escalation).
  let roleId: string | undefined;
  if (typeof body.role_id === "string" && body.role_id) {
    const role = await Role.findOne({ role_id: body.role_id, is_active: true })
      .lean<{ permissions: string[]; price_access?: PriceAccess } | null>();
    if (!role) return NextResponse.json({ error: "Unknown role_id" }, { status: 400 });
    const rolePerms = role.permissions.filter(isPermissionKey);
    if (rolePerms.some((p) => !auth.permissions.has(p))) {
      return NextResponse.json({ error: "You cannot assign a role with permissions you do not hold" }, { status: 403 });
    }
    if (priceAccessRank(role.price_access ?? "none") > priceAccessRank(auth.priceAccess)) {
      return NextResponse.json({ error: "You cannot assign a role with higher price access than your own" }, { status: 403 });
    }
    roleId = body.role_id;
  }

  // Ceiling-check scope_values.
  let scopeValues: ScopeValues = { channels: "all", customers: "all", price_lists: "all" };
  if (body.scope_values && typeof body.scope_values === "object") {
    const sv = body.scope_values as Record<string, unknown>;
    scopeValues = { channels: scopeDim(sv.channels), customers: scopeDim(sv.customers), price_lists: scopeDim(sv.price_lists) };
    if (!scopeWithinCeiling(scopeValues, auth.scope)) {
      return NextResponse.json({ error: "You cannot grant a broader scope than your own" }, { status: 403 });
    }
  }

  // Ceiling-check price_access override.
  let priceAccess: PriceAccess | undefined;
  if (body.price_access != null && body.price_access !== "" && isPriceAccess(body.price_access as string)) {
    if (priceAccessRank(body.price_access as PriceAccess) > priceAccessRank(auth.priceAccess)) {
      return NextResponse.json({ error: "You cannot grant price access higher than your own" }, { status: 403 });
    }
    priceAccess = body.price_access as PriceAccess;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const created = await B2BUser.create({
    username,
    email,
    passwordHash,
    companyName,
    isActive: body.isActive === false ? false : true,
    role_id: roleId,
    scope_values: scopeValues,
    price_access: priceAccess,
  });

  const mail = await sendWelcomeEmail(
    { ragioneSociale: companyName, username, password: tempPassword, contactName: username },
    email
  );

  const safe = await B2BUser.findById(created._id).select(SAFE_FIELDS).lean();
  return NextResponse.json({ success: true, data: { user: safe, emailSent: mail.success } }, { status: 201 });
}
