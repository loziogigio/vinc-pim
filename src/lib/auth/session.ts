import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSessionData = {
  isLoggedIn?: boolean;
  username?: string;
  lastLoginAt?: string;
};

const DEFAULT_SESSION_SECRET = "dev-admin-session-secret-change-me-please-123456";

export const sessionOptions: SessionOptions = {
  cookieName: "vinc_admin_session",
  password: process.env.ADMIN_SESSION_SECRET ?? DEFAULT_SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  }
};

export const getAdminSession = async (): Promise<IronSession<AdminSessionData>> => {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);
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
