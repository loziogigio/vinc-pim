import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { getTemplateConfig } from "@/lib/db/product-templates-simple";

const assertAdminSession = async () => {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
};

/**
 * GET /api/product-template?matchType=sku&value=rm7001
 * Load a product template configuration
 */
export async function GET(request: Request) {
  try {
    const session = await assertAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchType = searchParams.get("matchType");
    const value = searchParams.get("value");

    if (!matchType || !value) {
      return NextResponse.json(
        { error: "Missing matchType or value parameter" },
        { status: 400 }
      );
    }

    if (!["sku", "parent", "parentSku", "standard"].includes(matchType)) {
      return NextResponse.json({ error: "Invalid matchType" }, { status: 400 });
    }

    // Normalize matchType: "parent" -> "parentSku"
    const normalizedMatchType = matchType === "parent" ? "parentSku" : matchType;

    const config = await getTemplateConfig(
      normalizedMatchType as "sku" | "parentSku" | "standard",
      value
    );

    return NextResponse.json(config);
  } catch (error) {
    console.error("Get product template error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load template";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
