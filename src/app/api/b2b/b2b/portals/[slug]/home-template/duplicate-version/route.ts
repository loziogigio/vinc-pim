import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { duplicateVersionInPortal } from "@/lib/services/b2b-home-template.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/home-template/duplicate-version
 * Clones an existing version into a new draft, which becomes the current version.
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

    const config = await duplicateVersionInPortal(auth.tenantDb, slug, version);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST duplicate-version]", error);
    const message = error instanceof Error ? error.message : "Failed to duplicate version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
