import { NextRequest, NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { getHomeTemplateConfig, loadHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * GET /api/home-template
 * Load home page template configuration
 * Supports ?v=X query param to load a specific version
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for version query param
    const { searchParams } = new URL(request.url);
    const versionParam = searchParams.get("v");

    // If version specified, switch to that version first
    if (versionParam) {
      const version = parseInt(versionParam, 10);
      if (!isNaN(version) && version > 0) {
        console.log(`[GET /api/home-template] Loading specific version: ${version}`);
        const config = await loadHomeTemplateVersion(version);
        return NextResponse.json(config);
      }
    }

    // Otherwise return current config
    const config = await getHomeTemplateConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Get home template error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load home template";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
