/**
 * Server-side authorization resolution for the cookie-session B2B dashboard.
 * Used from server components, which have no NextRequest to pass to
 * requireTenantAuth/resolveAuthorization. The dashboard session stores the
 * B2BUser Mongo _id; this helper resolves authorization directly from the
 * session by _id and returns a serializable DTO for the client
 * PermissionsProvider.
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
