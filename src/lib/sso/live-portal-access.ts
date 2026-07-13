import { connectWithModels } from "@/lib/db/connection";
import type { ISSOSessionVincProfile } from "@/lib/db/models/sso-session";

export interface LivePortalAccess {
  profile?: ISSOSessionVincProfile;
}

/**
 * Intersect a session profile with the current portal-user permissions.
 *
 * Session profiles carry the ERP-facing codes needed by storefronts, while
 * the portal-user record remains the authorization source of truth. Returning
 * null means the user no longer exists or is inactive. Existing sessions with
 * no stored profile remain valid, but receive no customer/address context.
 */
export async function resolveLivePortalAccess(
  tenantDb: string,
  tenantId: string,
  userId: string,
  profile?: ISSOSessionVincProfile,
): Promise<LivePortalAccess | null> {
  const { PortalUser } = await connectWithModels(tenantDb);
  const portalUser = await PortalUser.findOne(
    {
      portal_user_id: userId,
      tenant_id: tenantId,
      is_active: true,
    },
    { customer_access: 1 },
  ).lean();
  if (!portalUser) return null;
  if (!profile) return {};

  const liveAccess = new Map<string, "all" | Set<string>>();
  for (const access of (portalUser as any).customer_access ?? []) {
    if (typeof access?.customer_id !== "string") continue;
    liveAccess.set(
      access.customer_id,
      access.address_access === "all"
        ? "all"
        : new Set(
            Array.isArray(access.address_access)
              ? access.address_access.filter(
                  (id: unknown): id is string => typeof id === "string"
                )
              : []
          )
    );
  }

  return {
    profile: {
      ...profile,
      customers: (profile.customers ?? [])
        .filter((customer) => liveAccess.has(customer.id))
        .map((customer) => {
          const addressAccess = liveAccess.get(customer.id);
          return {
            ...customer,
            addresses: (customer.addresses ?? []).filter(
              (address) =>
                addressAccess === "all" ||
                (addressAccess instanceof Set &&
                  addressAccess.has(address.id))
            ),
          };
        }),
    },
  };
}
