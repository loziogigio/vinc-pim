import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? DEFAULT_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { username, password } = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);
  session.isLoggedIn = true;
  session.username = ADMIN_USERNAME;
  session.lastLoginAt = new Date().toISOString();
  await session.save();

  return NextResponse.json({ ok: true });
}
