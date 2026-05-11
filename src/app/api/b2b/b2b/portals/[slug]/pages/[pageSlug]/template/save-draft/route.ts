import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { saveB2BPageTemplateDraft } from "@/lib/db/b2b-page-templates";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/save-draft
 * Save draft blocks for a B2B portal page
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, pageSlug } = await params;
    const { blocks, seo } = await req.json();

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
    }

    const config = await saveB2BPageTemplateDraft(slug, pageSlug, { blocks, seo }, auth.tenantDb);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/save-draft]", error);
    const message = error instanceof Error ? error.message : "Failed to save draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
