import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { publishPage } from "@/lib/db/pages";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const page = await publishPage(slug);
    return NextResponse.json(page);
  } catch (error) {
    console.error("Failed to publish page:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish page" },
      { status: 500 }
    );
  }
}
