import { NextRequest, NextResponse } from "next/server";
import { saveBlogContentDraft } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext, assertPostInStore } from "../../../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; postId: string }> };

/** POST — save a draft version for a post in this storefront. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertPostInStore(ctx.tenantDb, postId, slug);
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const { blocks, seo } = await req.json();
    if (!Array.isArray(blocks)) return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
    const config = await saveBlogContentDraft(ctx.tenantDb, postId, locale, { blocks, seo });
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to save draft");
  }
}
