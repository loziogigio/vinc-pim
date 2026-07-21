import { NextRequest, NextResponse } from "next/server";
import { listBlogPosts, createBlogPost } from "@/lib/services/blog/blog-post.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext } from "../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string }> };

/** GET — list posts scoped to this storefront (client `channel` param is ignored). */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const { searchParams } = new URL(req.url);
    const result = await listBlogPosts(ctx.tenantDb, {
      channel: slug,
      locale: searchParams.get("locale") || undefined,
      status: searchParams.get("status") || undefined,
      category: searchParams.get("category") || undefined,
      tag: searchParams.get("tag") || undefined,
      q: searchParams.get("q") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return blogError(error, "Failed to list blog posts");
  }
}

/** POST — create a post force-tagged to this storefront (client `channels` ignored). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const body = await req.json();
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const post = await createBlogPost(
      ctx.tenantDb,
      { ...body, channels: [slug] },
      { skipChannelValidation: true },
    );
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    return blogError(error, "Failed to create blog post");
  }
}
