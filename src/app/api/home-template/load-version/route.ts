import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { loadHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * POST /api/home-template/load-version
 * Switch the current draft to a specific historical version
 */
export async function POST(request: Request) {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { version } = body ?? {};

    if (typeof version !== "number") {
      return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
    }

    const updated = await loadHomeTemplateVersion(version);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Load home template version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
