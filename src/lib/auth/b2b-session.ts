/**
 * B2B Session Management
 * Handles session creation, retrieval, and destruction for B2B users
 */

import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import type { B2BSessionData } from "@/lib/types/b2b";

const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long",
  cookieName: "vinc_b2b_session",
  cookieOptions: {
    // Only use secure cookies if explicitly enabled via env var (requires HTTPS)
    // Set SECURE_COOKIES=true when HTTPS is configured
    secure: process.env.SECURE_COOKIES === "true",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/", // Required for cookie to be sent to all routes (including /api/*)
  },
};

export async function getB2BSession(): Promise<IronSession<B2BSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<B2BSessionData>(cookieStore, sessionOptions);
}

export async function createB2BSession(userData: Omit<B2BSessionData, "isLoggedIn" | "lastLoginAt">) {
  const session = await getB2BSession();
  session.isLoggedIn = true;
  session.tenantId = userData.tenantId;
  session.userId = userData.userId;
  session.username = userData.username;
  session.email = userData.email;
  session.role = userData.role;
  session.companyName = userData.companyName;
  session.lastLoginAt = new Date().toISOString();
  await session.save();
}

export async function destroyB2BSession() {
  const session = await getB2BSession();
  session.destroy();
}

export async function isB2BAuthenticated(): Promise<boolean> {
  const session = await getB2BSession();
  return session.isLoggedIn === true;
}
