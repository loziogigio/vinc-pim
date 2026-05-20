import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getBlogContent } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";

type RouteParams = { params: Promise<{ postId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { postId } = await params;
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const config = await getBlogContent(auth.tenantDb, postId, locale);
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to get blog content");
  }
}
