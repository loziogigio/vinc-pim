import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getBlogPost, updateBlogPost, deleteBlogPost } from "@/lib/services/blog/blog-post.service";
import { blogError } from "@/lib/services/blog/respond";

type RouteParams = { params: Promise<{ postId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { postId } = await params;
    const post = await getBlogPost(auth.tenantDb, postId);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return blogError(error, "Failed to get blog post");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { postId } = await params;
    const body = await req.json();
    const post = await updateBlogPost(auth.tenantDb, postId, body);
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return blogError(error, "Failed to update blog post");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { postId } = await params;
    await deleteBlogPost(auth.tenantDb, postId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return blogError(error, "Failed to delete blog post");
  }
}
