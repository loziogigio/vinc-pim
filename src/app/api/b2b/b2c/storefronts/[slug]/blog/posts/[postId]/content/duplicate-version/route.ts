import { NextRequest, NextResponse } from "next/server";
import { duplicateBlogContentVersion } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext, assertPostInStore } from "../../../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; postId: string }> };

/** POST — duplicate a version for a post in this storefront. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertPostInStore(ctx.tenantDb, postId, slug);
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const { version } = await req.json();
    if (typeof version !== "number") return NextResponse.json({ error: "version (number) is required" }, { status: 400 });
    const config = await duplicateBlogContentVersion(ctx.tenantDb, postId, locale, version);
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to duplicate version");
  }
}
