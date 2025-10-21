import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { savePage } from "@/lib/db/pages";
import { saveTemplateDraft } from "@/lib/db/product-templates-simple";

const assertAdminSession = async () => {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
};

export async function POST(request: Request) {
  try {
    const session = await assertAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { matchType, value, blocks, seo, slug } = body;

    // Check if this is a product template (new simplified format)
    if (matchType && value) {
      if (!["sku", "parentSku"].includes(matchType)) {
        return NextResponse.json({ error: "Invalid matchType" }, { status: 400 });
      }
      if (!Array.isArray(blocks)) {
        return NextResponse.json({ error: "Invalid blocks" }, { status: 400 });
      }

      const saved = await saveTemplateDraft({
        matchType: matchType as "sku" | "parentSku",
        value,
        blocks,
        seo
      });
      return NextResponse.json(saved);
    }

    // Otherwise, save as regular page
    if (!slug || !Array.isArray(blocks)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const saved = await savePage({ slug, blocks, seo });
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Save draft error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save draft";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
