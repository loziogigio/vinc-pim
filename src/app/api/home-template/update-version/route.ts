import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { renameHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * PATCH /api/home-template/update-version
 * Update version label (rename)
 */
export async function PATCH(request: Request) {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { version, label } = body ?? {};

    if (typeof version !== "number") {
      return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
    }

    if (label != null && typeof label !== "string") {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 });
    }

    if (typeof label !== "string") {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    const updated = await renameHomeTemplateVersion({ version, label });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update home template version metadata error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update version metadata";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
