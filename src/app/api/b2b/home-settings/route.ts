import { NextRequest, NextResponse } from "next/server";
import { getHomeSettings, upsertHomeSettings, initializeHomeSettings } from "@/lib/db/home-settings";

/**
 * GET /api/b2b/home-settings
 * Fetch the global home settings configuration
 */
export async function GET() {
  try {
    const settings = await getHomeSettings();

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
    const { branding, defaultCardVariant, cardStyle, cdn_credentials, smtp_settings, footerHtml, footerHtmlDraft, headerConfig, headerConfigDraft, meta_tags, lastModifiedBy } = body;

    const settings = await upsertHomeSettings({
      branding,
      defaultCardVariant,
      cardStyle,
      cdn_credentials,
      smtp_settings,
      footerHtml,
      footerHtmlDraft,
      headerConfig,
      headerConfigDraft,
      meta_tags,
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
