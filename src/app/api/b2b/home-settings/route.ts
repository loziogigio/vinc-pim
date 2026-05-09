import { NextRequest, NextResponse } from "next/server";
import { getHomeSettings, upsertHomeSettings, initializeHomeSettings } from "@/lib/db/home-settings";
import { authenticateTenant } from "@/lib/auth/tenant-auth";

/**
 * GET /api/b2b/home-settings
 * Fetch the home settings configuration for the authenticated tenant.
 * Falls back to the default DB only when no tenant context is available.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    const tenantDb = auth.authenticated ? auth.tenantDb : undefined;

    const settings = await getHomeSettings(tenantDb);

    if (!settings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error in GET /api/b2b/home-settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/home-settings
 * Create or update the global home settings document
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branding, defaultCardVariant, cardStyle, cdn_credentials, smtp_settings, email_transport, graph_settings, company_info, footerHtml, footerHtmlDraft, headerConfig, headerConfigDraft, meta_tags, image_versions, lastModifiedBy } = body;

    const settings = await upsertHomeSettings({
      branding,
      defaultCardVariant,
      cardStyle,
      cdn_credentials,
      smtp_settings,
      email_transport,
      graph_settings,
      company_info,
      footerHtml,
      footerHtmlDraft,
      headerConfig,
      headerConfigDraft,
      meta_tags,
      image_versions,
      lastModifiedBy
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error in POST /api/b2b/home-settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/b2b/home-settings/initialize
 * Initialize default settings (kept for backwards compatibility)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyTitle } = body;

    if (!companyTitle) {
      return NextResponse.json(
        { error: "companyTitle is required" },
        { status: 400 }
      );
    }

    const settings = await initializeHomeSettings(companyTitle);

    if (!settings) {
      return NextResponse.json(
        { error: "Failed to initialize settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error in PUT /api/b2b/home-settings/initialize:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
