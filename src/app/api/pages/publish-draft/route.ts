import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { publishPage } from "@/lib/db/pages";
import { publishTemplate } from "@/lib/db/product-templates-simple";

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
    const { matchType, value, slug } = body;

    // Check if this is a product template (new simplified format)
    if (matchType && value) {
      if (!["sku", "parentSku"].includes(matchType)) {
        return NextResponse.json({ error: "Invalid matchType" }, { status: 400 });
      }

      const published = await publishTemplate(matchType as "sku" | "parentSku", value);
      return NextResponse.json(published);
    }

    // Otherwise, publish as regular page
    if (!slug) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const published = await publishPage(slug);
    return NextResponse.json(published);
  } catch (error) {
    console.error("Publish draft error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to publish draft";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
