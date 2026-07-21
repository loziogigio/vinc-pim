import { NextRequest, NextResponse } from "next/server";
import { listBlogCategories, createBlogCategory } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";
import { resolveStoreBlogContext } from "../_lib/store-blog";

type RouteParams = { params: Promise<{ slug: string }> };

/** GET — categories tagged with this storefront's channel. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const includeInactive = new URL(req.url).searchParams.get("include_inactive") === "true";
    const all: any[] = await listBlogCategories(ctx.tenantDb, { includeInactive });
    const items = all.filter((c) => c.channels?.includes(slug));
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    return blogError(error, "Failed to list categories");
  }
}

/** POST — create a category force-tagged to this storefront (client `channels` ignored). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ctx = await resolveStoreBlogContext(req, slug);
  if ("response" in ctx) return ctx.response;
  try {
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const cat = await createBlogCategory(ctx.tenantDb, { ...body, channels: [slug] });
    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (error) {
    return blogError(error, "Failed to create category");
  }
}
