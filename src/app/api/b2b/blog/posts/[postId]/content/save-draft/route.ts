import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { saveBlogContentDraft } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";

type RouteParams = { params: Promise<{ postId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { postId } = await params;
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const { blocks, seo } = await req.json();
    if (!Array.isArray(blocks)) return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
    const config = await saveBlogContentDraft(auth.tenantDb, postId, locale, { blocks, seo });
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to save draft");
  }
}
