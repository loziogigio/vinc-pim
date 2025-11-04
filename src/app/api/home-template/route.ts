import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { getHomeTemplateConfig } from "@/lib/db/home-templates";

/**
 * GET /api/home-template
 * Load home page template configuration
 */
export async function GET() {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getHomeTemplateConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Get home template error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load home template";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
