import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { updateBlogTag, deleteBlogTag } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { id } = await params;
    const tag = await updateBlogTag(auth.tenantDb, id, await req.json());
    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    return blogError(error, "Failed to update tag");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { id } = await params;
    await deleteBlogTag(auth.tenantDb, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return blogError(error, "Failed to delete tag");
  }
}
