import { NextRequest, NextResponse } from "next/server";
import { getBlogContent } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext, assertPostInStore } from "../../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; postId: string }> };

/** GET — content/versions for a post, only if it belongs to this storefront. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertPostInStore(ctx.tenantDb, postId, slug);
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const config = await getBlogContent(ctx.tenantDb, postId, locale);
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to get blog content");
  }
}
