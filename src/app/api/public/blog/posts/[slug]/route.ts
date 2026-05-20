import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getDefaultLanguage } from "@/config/languages";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/public/blog/posts/[slug] — published content of one post for a channel+locale.
 * Tenant resolved via x-resolved-tenant-db header (no auth).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const tenantDb = req.headers.get("x-resolved-tenant-db");
    if (!tenantDb) return NextResponse.json({ error: "Tenant not resolved" }, { status: 400 });

    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel") || "default";
    const locale = searchParams.get("locale") || getDefaultLanguage().code;

    const { BlogPost, BlogPostVersion } = await connectWithModels(tenantDb);
    const post: any = await BlogPost.findOne({ slug, channels: channel }).lean();
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const tr = post.translations.find((t: any) => t.locale === locale && t.status === "published");
    if (!tr || !tr.published_version) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const version: any = await BlogPostVersion.findOne({ post_id: post.post_id, locale, version: tr.published_version }).lean();
    if (!version) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        slug: post.slug, locale, title: tr.title, excerpt: tr.excerpt ?? null,
        published_at: tr.published_at ?? null, cover_image: post.cover_image ?? null,
        category_ids: post.category_ids, tag_ids: post.tag_ids,
        blocks: version.blocks || [], seo: version.seo || {},
      },
    });
  } catch (error) {
    console.error("[public blog get]", error);
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}
