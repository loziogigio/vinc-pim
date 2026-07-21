/**
 * DEVIATION FROM STOREFRONT-SCOPING: blog tags are TENANT-SHARED, not
 * store-tagged. The BlogTag model has no `channels` field, so these wrappers
 * only enforce the resolve guard (auth + storefront exists) and then pass
 * through to the tenant-wide tag service unchanged — GET lists all tags,
 * POST creates a tenant-wide tag. Categories ARE store-tagged; tags are not.
 */
import { NextRequest, NextResponse } from "next/server";
import { listBlogTags, createBlogTag } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext } from "../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string }> };

/** GET — all tenant tags (tags are tenant-shared, not store-scoped). */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const includeInactive = new URL(req.url).searchParams.get("include_inactive") === "true";
    const items = await listBlogTags(ctx.tenantDb, { includeInactive });
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    return blogError(error, "Failed to list tags");
  }
}

/** POST — create a tenant-wide tag (tags are tenant-shared, not store-scoped). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const tag = await createBlogTag(ctx.tenantDb, body);
    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    return blogError(error, "Failed to create tag");
  }
}
