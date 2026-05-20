import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listBlogCategories, createBlogCategory } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const includeInactive = new URL(req.url).searchParams.get("include_inactive") === "true";
    const items = await listBlogCategories(auth.tenantDb, { includeInactive });
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    return blogError(error, "Failed to list categories");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const cat = await createBlogCategory(auth.tenantDb, body);
    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (error) {
    return blogError(error, "Failed to create category");
  }
}
