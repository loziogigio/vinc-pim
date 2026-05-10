import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { unpublishVersionInPortal } from "@/lib/services/b2b-home-template.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/home-template/unpublish-version
 * Reverts a published version back to draft status.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { slug } = await ctx.params;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(
        NOT_MIGRATED_RESPONSE_BODY,
        { status: 409 },
      );
    }

    const body = await req.json();
    const { version } = body ?? {};

    if (typeof version !== "number") {
      return NextResponse.json({ error: "version (number) is required" }, { status: 400 });
    }

    const config = await unpublishVersionInPortal(auth.tenantDb, slug, version);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST unpublish-version]", error);
    const message = error instanceof Error ? error.message : "Failed to unpublish version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
