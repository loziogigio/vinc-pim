import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { deleteVersion } from "@/lib/db/pages";

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
    const { slug, version } = body;

    if (!slug || typeof version !== "number") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updatedPage = await deleteVersion(slug, version);
    return NextResponse.json(updatedPage);
  } catch (error) {
    console.error("Delete version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
