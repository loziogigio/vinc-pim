import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { saveHomeTemplateDraft } from "@/lib/db/home-templates";

/**
 * POST /api/home-template/save-draft
 * Save home page template draft
 */
export async function POST(request: Request) {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { blocks, seo } = body;

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "Invalid blocks" }, { status: 400 });
    }

    const saved = await saveHomeTemplateDraft({
      blocks,
      seo
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Save home template draft error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save home template";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
