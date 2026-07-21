import { NextRequest, NextResponse } from "next/server";
import { updateBlogPost, deleteBlogPost } from "@/lib/services/blog/blog-post.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext, assertPostInStore } from "../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; postId: string }> };

/** GET — one post, only if it belongs to this storefront. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const post = await assertPostInStore(ctx.tenantDb, postId, slug);
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return blogError(error, "Failed to get blog post");
  }
}

/** PATCH — update a post in this storefront; `channels` can never be reassigned here. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertPostInStore(ctx.tenantDb, postId, slug);
    const { channels: _ignored, ...patch } = await req.json();
    const post = await updateBlogPost(ctx.tenantDb, postId, patch);
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return blogError(error, "Failed to update blog post");
  }
}

/** DELETE — remove a post in this storefront. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { slug, postId } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertPostInStore(ctx.tenantDb, postId, slug);
    await deleteBlogPost(ctx.tenantDb, postId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return blogError(error, "Failed to delete blog post");
  }
}
