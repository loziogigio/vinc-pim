import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSessionData = {
  isLoggedIn?: boolean;
  username?: string;
  lastLoginAt?: string;
};

function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_SESSION_SECRET must be set (min 32 chars) in production");
    }
    // Dev-only fallback — never used in production
    return "dev-admin-session-secret-change-me-please-123456";
  }
  return secret;
}

export function sessionOptions(): SessionOptions {
  return {
    cookieName: "vinc_admin_session",
    password: getAdminSessionSecret(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    }
  };
}

export const getAdminSession = async (): Promise<IronSession<AdminSessionData>> => {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions());
  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
  }
  return session;
};

export const requireAdminSession = async () => {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
};
