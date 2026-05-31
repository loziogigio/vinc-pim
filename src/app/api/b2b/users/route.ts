import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { requirePermission } from "@/lib/api/require-permission";
import { connectWithModels } from "@/lib/db/connection";

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
