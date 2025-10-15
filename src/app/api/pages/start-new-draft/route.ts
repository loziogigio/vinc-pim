import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { startNewVersion } from "@/lib/db/pages";

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
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const newVersion = await startNewVersion(slug);
    return NextResponse.json(newVersion);
  } catch (error) {
    console.error("Start new draft error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to start new draft";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
