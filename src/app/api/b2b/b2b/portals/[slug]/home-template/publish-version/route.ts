import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { publishVersionInPortal } from "@/lib/services/b2b-home-template.service";
import { isTenantMigrated } from "@/lib/services/b2b-portal-migration-flag.service";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { slug } = await ctx.params;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(
        { error: "B2B portal not migrated for this tenant.", code: "NOT_MIGRATED" },
        { status: 409 },
      );
    }

    const body = await req.json();
    const { version, ...rest } = body;
    if (typeof version !== "number") {
      return NextResponse.json({ error: "version (number) is required" }, { status: 400 });
    }
    const config = await publishVersionInPortal(auth.tenantDb, slug, version, rest);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/home-template/publish-version]", error);
    return NextResponse.json({ error: "Failed to publish version" }, { status: 500 });
  }
}
