import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { startNewVersionInPortal } from "@/lib/services/b2b-home-template.service";
import { isTenantMigrated } from "@/lib/services/b2b-portal-migration-flag.service";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/home-template/start-new-version
 * Creates a new draft version based on the latest published (or current) version.
 */
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

    const config = await startNewVersionInPortal(auth.tenantDb, slug);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST start-new-version]", error);
    const message = error instanceof Error ? error.message : "Failed to start new version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
