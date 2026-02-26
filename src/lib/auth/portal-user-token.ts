/**
 * Portal User Token Utilities
 *
 * JWT token generation and verification for portal user authentication.
 * Uses jose library for JWT operations.
 */

import { SignJWT, jwtVerify } from "jose";
import type { IPortalUserTokenPayload, ICustomerAccess, IPortalUserContext } from "@/lib/types/portal-user";
import { connectWithModels } from "@/lib/db/connection";

// Secret key for signing tokens
const getSecret = () => {
  const secret = process.env.PORTAL_USER_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("PORTAL_USER_TOKEN_SECRET or SESSION_SECRET must be set");
  }
  return new TextEncoder().encode(secret);
};

// Token expiration (7 days)
const TOKEN_EXPIRATION = "7d";

/**
 * Generate a JWT token for a portal user
 * @param customerTags - Customer pricing tags (full_tag values) for tag-based search filtering
 */
export async function generatePortalUserToken(
  portalUserId: string,
  tenantId: string,
  customerTags?: string[]
): Promise<string> {
  const payload: Record<string, unknown> = { portalUserId, tenantId };
  if (customerTags?.length) {
    payload.customerTags = customerTags;
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(getSecret());

  return token;
}

/**
 * Verify a portal user JWT token
 * Returns the payload if valid, null if invalid
 */
export async function verifyPortalUserToken(
  token: string
): Promise<IPortalUserTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as IPortalUserTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Get portal user context from request headers
 * Returns null if no token or invalid token
 */
export async function getPortalUserFromRequest(
  request: Request,
  tenantDb?: string
): Promise<IPortalUserContext | null> {
  const token = request.headers.get("x-portal-user-token");
  if (!token) {
    return null;
  }

  const payload = await verifyPortalUserToken(token);
  if (!payload) {
    return null;
  }

  // If tenantDb provided, verify tenant matches and fetch user
  if (tenantDb) {
    const expectedTenant = tenantDb.replace("vinc-", "");
    if (payload.tenantId !== expectedTenant) {
      return null; // Token tenant doesn't match request tenant
    }

    // Fetch user to get current customer_access using connectWithModels
    const { PortalUser } = await connectWithModels(tenantDb);
    const user = await PortalUser.findOne({
      portal_user_id: payload.portalUserId,
      tenant_id: payload.tenantId,
      is_active: true,
    }).lean();

    if (!user) {
      return null;
    }

    return {
      portalUserId: payload.portalUserId,
      tenantId: payload.tenantId,
      customerAccess: user.customer_access as ICustomerAccess[],
    };
  }

  // Without tenantDb, return basic info (customer_access needs to be fetched separately)
  return {
    portalUserId: payload.portalUserId,
    tenantId: payload.tenantId,
    customerAccess: [],
  };
}

/**
 * Check if portal user has access to a specific customer
 */
export function hasCustomerAccess(
  customerAccess: ICustomerAccess[],
  customerId: string
): boolean {
  return customerAccess.some((ca) => ca.customer_id === customerId);
}

/**
 * Check if portal user has access to a specific address
 */
export function hasAddressAccess(
  customerAccess: ICustomerAccess[],
  customerId: string,
  addressId: string
): boolean {
  const ca = customerAccess.find((c) => c.customer_id === customerId);
  if (!ca) return false;
  if (ca.address_access === "all") return true;
  return Array.isArray(ca.address_access) && ca.address_access.includes(addressId);
}

/**
 * Get list of customer IDs the portal user can access
 */
export function getAccessibleCustomerIds(customerAccess: ICustomerAccess[]): string[] {
  return customerAccess.map((ca) => ca.customer_id);
}

/**
 * Get list of address IDs the portal user can access for a customer
 * Returns null if user has access to all addresses
 */
export function getAccessibleAddressIds(
  customerAccess: ICustomerAccess[],
  customerId: string
): string[] | null {
  const ca = customerAccess.find((c) => c.customer_id === customerId);
  if (!ca) return [];
  if (ca.address_access === "all") return null; // null means all addresses
  return ca.address_access;
}
