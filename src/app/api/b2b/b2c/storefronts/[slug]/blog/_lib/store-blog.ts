/**
 * Shared guards for the storefront-scoped blog wrapper routes.
 *
 * Every wrapper first resolves a tenant (requireTenantAuth) AND verifies the
 * storefront slug exists, so the slug can safely be used as the blog channel
 * tag (a verified storefront slug, not a SalesChannel). Post-level routes then
 * assert the post is actually tagged with this storefront before touching it —
 * this is the cross-store isolation backbone.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getStorefrontBySlug } from "@/lib/services/b2c-storefront.service";
import { getBlogPost } from "@/lib/services/blog/blog-post.service";
import { listBlogCategories } from "@/lib/services/blog/blog-taxonomy.service";
import type { IBlogPost } from "@/lib/db/models/blog-post";

function httpError(message: string, status: number): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/**
 * requireTenantAuth + verify the storefront slug exists.
 * Returns `{ tenantDb }` or a `{ response }` (401 unauth / 404 unknown store).
 */
export async function resolveStoreBlogContext(
  req: NextRequest,
  slug: string,
): Promise<{ tenantDb: string } | { response: NextResponse }> {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return { response: auth.response };

  const storefront = await getStorefrontBySlug(auth.tenantDb, slug);
  if (!storefront) {
    return { response: NextResponse.json({ error: "Storefront not found" }, { status: 404 }) };
  }
  return { tenantDb: auth.tenantDb };
}

/**
 * Load a post and assert it belongs to this storefront's channel.
 * Throws a 404-carrying error otherwise (mapped by `blogError`).
 */
export async function assertPostInStore(
  tenantDb: string,
  postId: string,
  slug: string,
): Promise<IBlogPost> {
  const post = await getBlogPost(tenantDb, postId);
  if (!post || !post.channels?.includes(slug)) {
    throw httpError("Post not found", 404);
  }
  return post;
}

/**
 * Assert a blog category is tagged with this storefront's channel.
 * Throws a 404-carrying error otherwise (mapped by `blogError`).
 */
export async function assertCategoryInStore(
  tenantDb: string,
  categoryId: string,
  slug: string,
): Promise<void> {
  const categories: any[] = await listBlogCategories(tenantDb, { includeInactive: true });
  const cat = categories.find((c) => c.category_id === categoryId);
  if (!cat || !cat.channels?.includes(slug)) {
    throw httpError("Category not found", 404);
  }
}
