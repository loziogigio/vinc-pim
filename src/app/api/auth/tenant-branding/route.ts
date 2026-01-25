/**
 * Public Tenant Branding API
 *
 * Returns public branding information for the login page.
 * No authentication required.
 *
 * GET /api/auth/tenant-branding?tenant_id=hidros-it
 */

import { NextRequest, NextResponse } from "next/server";
import { getHomeSettings } from "@/lib/db/home-settings";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }

    // Validate tenant_id format (alphanumeric, hyphens, lowercase)
    if (!/^[a-z0-9-]+$/.test(tenantId)) {
      return NextResponse.json(
        { error: "Invalid tenant_id format" },
        { status: 400 }
      );
    }

    const tenantDb = `vinc-${tenantId}`;
    const settings = await getHomeSettings(tenantDb);

    if (!settings || !settings.branding) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Return only public branding information
    return NextResponse.json({
      tenant_id: tenantId,
      branding: {
        title: settings.branding.title || tenantId,
        logo: settings.branding.logo || null,
        favicon: settings.branding.favicon || null,
        primaryColor: settings.branding.primaryColor || "#6366f1",
        shopUrl: settings.branding.shopUrl || null,
        websiteUrl: settings.branding.websiteUrl || null,
      },
    });
  } catch (error) {
    console.error("Tenant branding error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant branding" },
      { status: 500 }
    );
  }
}
