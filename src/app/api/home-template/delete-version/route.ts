import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { deleteHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * POST /api/home-template/delete-version
 * Permanently remove a historical version
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

    const updated = await deleteHomeTemplateVersion(version);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Delete home template version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
