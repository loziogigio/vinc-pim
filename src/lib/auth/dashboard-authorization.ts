/**
 * Server-side authorization resolution for the cookie-session B2B dashboard.
 * The dashboard session stores the B2BUser Mongo _id and is tagged portal_user
 * by authenticateTenant, so it cannot go through resolveAuthorization's
 * b2b_user gate. This helper resolves directly from the session by _id and
 * returns a serializable DTO for the client PermissionsProvider.
 */
import {
  authorizationForB2BUser,
  toPermissionsDTO,
  emptyAuthorization,
  type PermissionsDTO,
  type B2BUserAuthDoc,
} from "./authorization";

export async function getDashboardAuthorization(): Promise<PermissionsDTO> {
  try {
    const { getB2BSession } = await import("./b2b-session");
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId || !session.userId) {
      return toPermissionsDTO(emptyAuthorization());
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { connectWithModels } = await import("@/lib/db/connection");
    const { B2BUser } = await connectWithModels(tenantDb);

    const user = await B2BUser.findOne({ _id: session.userId, isActive: true })
      .lean<B2BUserAuthDoc | null>();
    if (!user) return toPermissionsDTO(emptyAuthorization());

    const authz = await authorizationForB2BUser(user, tenantDb, session.tenantId);
    return toPermissionsDTO(authz);
  } catch (err) {
    console.warn("[getDashboardAuthorization] failed, denying:", err);
    return toPermissionsDTO(emptyAuthorization());
  }
}
