import { NextRequest, NextResponse } from "next/server";
import { updateBlogCategory, deleteBlogCategory } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext, assertCategoryInStore } from "../../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string; id: string }> };

/** PUT — update a category, only if it belongs to this storefront. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { slug, id } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertCategoryInStore(ctx.tenantDb, id, slug);
    const { channels: _ignored, ...patch } = await req.json();
    const cat = await updateBlogCategory(ctx.tenantDb, id, patch);
    return NextResponse.json({ success: true, data: cat });
  } catch (error) {
    return blogError(error, "Failed to update category");
  }
}

/** DELETE — remove a category, only if it belongs to this storefront. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { slug, id } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    await assertCategoryInStore(ctx.tenantDb, id, slug);
    await deleteBlogCategory(ctx.tenantDb, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return blogError(error, "Failed to delete category");
  }
}
