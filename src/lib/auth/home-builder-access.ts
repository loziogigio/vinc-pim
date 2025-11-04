import type { IronSession } from "iron-session";
import { requireAdminSession, type AdminSessionData } from "./session";
import { getB2BSession } from "./b2b-session";
import type { B2BSessionData, B2BUserRole } from "@/lib/types/b2b";

export type HomeBuilderSession =
  | { type: "admin"; session: IronSession<AdminSessionData> }
  | { type: "b2b"; session: IronSession<B2BSessionData> };

const ALLOWED_B2B_ROLES: B2BUserRole[] = ["admin", "manager"];

export async function getHomeBuilderSession(): Promise<HomeBuilderSession | null> {
  const adminSession = await requireAdminSession();
  if (adminSession) {
    return { type: "admin", session: adminSession };
  }

  const b2bSession = await getB2BSession();
  if (b2bSession?.isLoggedIn && b2bSession.role && ALLOWED_B2B_ROLES.includes(b2bSession.role)) {
    return { type: "b2b", session: b2bSession };
  }

  return null;
}

export async function hasHomeBuilderAccess(): Promise<boolean> {
  return (await getHomeBuilderSession()) !== null;
}
