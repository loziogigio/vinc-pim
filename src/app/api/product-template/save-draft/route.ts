import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { saveTemplateDraft } from "@/lib/db/product-templates-simple";

const assertAdminSession = async () => {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
};

/**
 * POST /api/product-template/save-draft
 * Save a product template draft
 */
export async function POST(request: Request) {
  try {
    const session = await assertAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { matchType, value, blocks, seo } = body;

    if (!matchType || !value) {
      return NextResponse.json(
        { error: "Missing matchType or value" },
        { status: 400 }
      );
    }

    if (!["sku", "parent", "parentSku", "standard"].includes(matchType)) {
      return NextResponse.json({ error: "Invalid matchType" }, { status: 400 });
    }

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "Invalid blocks" }, { status: 400 });
    }

    // Normalize matchType: "parent" -> "parentSku"
    const normalizedMatchType = matchType === "parent" ? "parentSku" : matchType;

    const saved = await saveTemplateDraft({
      matchType: normalizedMatchType as "sku" | "parentSku" | "standard",
      value,
      blocks,
      seo
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Save template draft error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save template";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
