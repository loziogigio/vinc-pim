/**
 * GET /api/b2b/likes/user — Get current user's liked products (wishlist)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getUserLikes } from "@/lib/services/like.service";
import { LIKE_PAGINATION } from "@/lib/constants/like";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || String(LIKE_PAGINATION.DEFAULT_PAGE)));
  const limit = Math.min(
    LIKE_PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(LIKE_PAGINATION.DEFAULT_LIMIT)))
  );

  const { likes, total_count } = await getUserLikes(tenantDb, tenantId, userId!, page, limit);

  return NextResponse.json({
    success: true,
    data: {
      likes,
      total_count,
      page,
      page_size: limit,
      has_next: page * limit < total_count,
    },
  });
}
