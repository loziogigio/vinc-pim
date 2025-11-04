import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { duplicateHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * POST /api/home-template/duplicate-version
 * Clone an existing version into a new draft
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

    const updated = await duplicateHomeTemplateVersion(version);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Duplicate home template version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to duplicate version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
