/**
 * B2B Session Management
 * Handles session creation, retrieval, and destruction for B2B users
 */

import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import type { B2BSessionData } from "@/lib/types/b2b";

function getSessionOptions() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET env var must be set and at least 32 characters long");
  }
  return {
    password: secret,
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
}

export async function getB2BSession(): Promise<IronSession<B2BSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<B2BSessionData>(cookieStore, getSessionOptions());
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

/**
 * Verify B2B session and return session data if authenticated, null otherwise.
 */
export async function verifyB2BSession(): Promise<B2BSessionData | null> {
  const session = await getB2BSession();
  if (!session.isLoggedIn) return null;
  return session;
}
