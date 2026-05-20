import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listBlogPosts, createBlogPost } from "@/lib/services/blog/blog-post.service";
import { blogError } from "@/lib/services/blog/respond";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const result = await listBlogPosts(auth.tenantDb, {
      channel: searchParams.get("channel") || undefined,
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

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const body = await req.json();
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const post = await createBlogPost(auth.tenantDb, body);
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    return blogError(error, "Failed to create blog post");
  }
}
