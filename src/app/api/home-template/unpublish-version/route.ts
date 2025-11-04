import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { unpublishHomeTemplateVersion } from "@/lib/db/home-templates";

/**
 * POST /api/home-template/unpublish-version
 * Revert a published version back to draft
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

    const updated = await unpublishHomeTemplateVersion(version);
    revalidatePath("/");
    revalidatePath("/preview");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Unpublish home template version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to unpublish version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
