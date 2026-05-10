import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { updateVersionInPortal } from "@/lib/services/b2b-home-template.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * PATCH /api/b2b/b2b/portals/[slug]/home-template/update-version
 * Updates version metadata (currently: label / rename).
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
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
    const { version, label } = body ?? {};

    if (typeof version !== "number") {
      return NextResponse.json({ error: "version (number) is required" }, { status: 400 });
    }

    if (label != null && typeof label !== "string") {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 });
    }

    if (typeof label !== "string") {
      return NextResponse.json({ error: "label (string) is required" }, { status: 400 });
    }

    const config = await updateVersionInPortal(auth.tenantDb, slug, version, { label });
    return NextResponse.json(config);
  } catch (error) {
    console.error("[PATCH update-version]", error);
    const message = error instanceof Error ? error.message : "Failed to update version metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
