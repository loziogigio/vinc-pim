import { NextRequest, NextResponse } from "next/server";
import { publishBlogContent, scheduleBlogContent } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext, assertPostInStore } from "../../../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; postId: string }> };

/** POST — publish (or schedule) a post's current version in this storefront. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertPostInStore(ctx.tenantDb, postId, slug);
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const scheduledAt = body?.scheduled_at ? new Date(body.scheduled_at) : null;

    const config =
      scheduledAt && scheduledAt.getTime() > Date.now()
        ? await scheduleBlogContent(ctx.tenantDb, postId, locale, scheduledAt)
        : await publishBlogContent(ctx.tenantDb, postId, locale);
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to publish");
  }
}
