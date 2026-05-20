import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { publishBlogContent, scheduleBlogContent } from "@/lib/services/blog/blog-content.service";
import { blogError } from "@/lib/services/blog/respond";

type RouteParams = { params: Promise<{ postId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  try {
    const { postId } = await params;
    const locale = new URL(req.url).searchParams.get("locale");
    if (!locale) return NextResponse.json({ error: "locale is required" }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const scheduledAt = body?.scheduled_at ? new Date(body.scheduled_at) : null;

    const config =
      scheduledAt && scheduledAt.getTime() > Date.now()
        ? await scheduleBlogContent(auth.tenantDb, postId, locale, scheduledAt)
        : await publishBlogContent(auth.tenantDb, postId, locale);
    return NextResponse.json(config);
  } catch (error) {
    return blogError(error, "Failed to publish");
  }
}
