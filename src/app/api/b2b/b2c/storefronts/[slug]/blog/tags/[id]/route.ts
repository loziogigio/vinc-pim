/**
 * DEVIATION FROM STOREFRONT-SCOPING: blog tags are TENANT-SHARED, not
 * store-tagged (the BlogTag model has no `channels` field). These wrappers
 * only enforce the resolve guard (auth + storefront exists), then pass through
 * to the tenant-wide tag service by id. Categories ARE store-tagged; tags are not.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateBlogTag, deleteBlogTag } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext } from "../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; id: string }> };

/** PUT — update a tenant-wide tag by id. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { slug, id } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const tag = await updateBlogTag(ctx.tenantDb, id, await req.json());
    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    return blogError(error, "Failed to update tag");
  }
}

/** DELETE — remove a tenant-wide tag by id. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { slug, id } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await deleteBlogTag(ctx.tenantDb, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return blogError(error, "Failed to delete tag");
  }
}
