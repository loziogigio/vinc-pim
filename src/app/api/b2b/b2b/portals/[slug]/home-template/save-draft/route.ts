import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { saveDraftInPortal } from "@/lib/services/b2b-home-template.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type Ctx = { params: Promise<{ slug: string }> };

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

    const payload = await req.json();
    if (!Array.isArray(payload.blocks)) {
      return NextResponse.json({ error: "Invalid blocks" }, { status: 400 });
    }

    const config = await saveDraftInPortal(auth.tenantDb, slug, payload);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/home-template/save-draft]", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
