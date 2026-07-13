import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { uploadToCdn } from "vinc-cdn";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { connectWithModels } from "@/lib/db/connection";
import { getCdnConfig } from "@/lib/services/cdn-config";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";
import {
  buildPortalScriptFolder,
  hasSecureCdnEndpoint,
  isHttpsAssetUrl,
  validatePortalScriptFile,
} from "@/lib/uploads/portal-script-upload";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/scripts/upload
 *
 * Upload a validated JavaScript asset for one authenticated tenant portal.
 * The resulting URL is public because the storefront must load it directly.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    // Executable storefront assets require the same admin/manager access as
    // the portal builder, not merely a customer/API-key identity.
    if (
      auth.authMethod !== "session" ||
      auth.userType !== "b2b_user" ||
      !(await hasHomeBuilderAccess(auth.tenantId))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug } = await ctx.params;
    const { B2BPortal } = await connectWithModels(auth.tenantDb);
    const portalExists = await B2BPortal.exists({ slug });
    if (!portalExists) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Request must be multipart form data" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    // Do not use instanceof File: NextRequest and jsdom/undici can expose
    // standards-compatible File objects from different JavaScript realms.
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No JavaScript file provided" },
        { status: 400 },
      );
    }

    const validation = validatePortalScriptFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Passing tenantDb explicitly avoids using another tenant's cached config.
    const config = await getCdnConfig(auth.tenantDb);
    if (!config) {
      return NextResponse.json(
        { error: "CDN is not configured for this tenant" },
        { status: 503 },
      );
    }

    if (!hasSecureCdnEndpoint(config)) {
      return NextResponse.json(
        { error: "CDN must use an HTTPS endpoint for storefront scripts" },
        { status: 503 },
      );
    }

    const result = await uploadToCdn(config, {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: validation.contentType,
      fileName: file.name,
      customFolder: buildPortalScriptFolder(
        config.folder,
        auth.tenantId,
        slug,
      ),
    });

    if (!isHttpsAssetUrl(result.url)) {
      console.error(
        "[POST portal script upload] CDN returned a non-HTTPS asset URL",
      );
      return NextResponse.json(
        { error: "CDN did not return a secure asset URL" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: result.url,
        key: result.key,
        fileName: file.name,
        size: file.size,
        contentType: validation.contentType,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/scripts/upload]", error);
    return NextResponse.json(
      { error: "Failed to upload JavaScript file" },
      { status: 500 },
    );
  }
}
