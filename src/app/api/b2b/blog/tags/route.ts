import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listBlogTags, createBlogTag } from "@/lib/services/blog/blog-taxonomy.service";
import { blogError } from "@/lib/services/blog/respond";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const includeInactive = new URL(req.url).searchParams.get("include_inactive") === "true";
    const items = await listBlogTags(auth.tenantDb, { includeInactive });
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    return blogError(error, "Failed to list tags");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const tag = await createBlogTag(auth.tenantDb, body);
    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    return blogError(error, "Failed to create tag");
  }
}
