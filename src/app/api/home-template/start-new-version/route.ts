import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { startNewHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * POST /api/home-template/start-new-version
 * Create a new draft version based on the latest published version
 */
export async function POST() {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await startNewHomeTemplateVersion();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Start new home template version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to start new version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
