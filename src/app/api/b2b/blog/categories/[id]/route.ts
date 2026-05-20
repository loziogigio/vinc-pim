import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { updateBlogCategory, deleteBlogCategory } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { id } = await params;
    const cat = await updateBlogCategory(auth.tenantDb, id, await req.json());
    return NextResponse.json({ success: true, data: cat });
  } catch (error) {
    return blogError(error, "Failed to update category");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { id } = await params;
    await deleteBlogCategory(auth.tenantDb, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return blogError(error, "Failed to delete category");
  }
}
