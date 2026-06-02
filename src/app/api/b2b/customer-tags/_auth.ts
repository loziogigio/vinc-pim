import { getB2BSession } from "@/lib/auth/b2b-session";

/**
 * Session → tenant resolver shared by the customer-tags route handlers.
 * Returns null when there is no valid B2B session.
 *
 * (Underscore-prefixed module: not a route.)
 */
export async function getTagAuth() {
  const session = await getB2BSession();
  if (!session?.isLoggedIn || !session.tenantId) return null;
  return { tenantId: session.tenantId, tenantDb: `vinc-${session.tenantId}` };
}
