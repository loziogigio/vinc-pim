/**
 * Unified Tenant Authentication
 *
 * Supports multiple authentication methods:
 * 1. Bearer Token (JWT from SSO or Portal User)
 * 2. API Key (header-based) with optional Bearer token for user identity
 * 3. B2B Session (cookie-based)
 *
 * Use this for endpoints that need to be accessible from multiple clients.
 *
 * ## Mobile App Authentication (Best Practice)
 *
 * Mobile apps should use API key for tenant auth + Bearer token for user identity:
 *
 * ```
 * Headers:
 *   x-auth-method: api-key
 *   x-api-key-id: ak_{tenant}_{key}
 *   x-api-secret: sk_{secret}
 *   Authorization: Bearer <portal-user-jwt>   // For user identity
 * ```
 *
 * The Bearer token (portal user JWT) is verified to extract userId.
 * This is the standard OAuth2-style approach.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "./b2b-session";
import { verifyAPIKey } from "./api-key-auth";
import { validateAccessToken } from "@/lib/sso/tokens";
import { verifyPortalUserToken } from "./portal-user-token";

// ============================================
// TYPES
// ============================================

export type AuthMethod = "bearer" | "session" | "api-key";
export type UserType = "portal_user" | "b2b_user";

export interface TenantAuthResult {
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  userId?: string;
  email?: string;
  userType?: UserType;
  authMethod?: AuthMethod;
  error?: string;
}

// ============================================
// MAIN AUTH FUNCTION
// ============================================

/**
 * Authenticate a request using Bearer Token, API Key, or B2B Session.
 *
 * Checks in order:
 * 1. Bearer Token authentication (Authorization: Bearer <jwt>)
 * 2. API Key authentication (headers: x-api-key-id, x-api-secret)
 * 3. B2B Session authentication (cookie: vinc_b2b_session)
 *
 * @example
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const auth = await authenticateTenant(req);
 *   if (!auth.authenticated) {
 *     return NextResponse.json({ error: auth.error }, { status: 401 });
 *   }
 *   // Use auth.tenantDb, auth.userId, etc.
 * }
 * ```
 */
export async function authenticateTenant(req: NextRequest): Promise<TenantAuthResult> {
  // Check explicit auth method header first
  const authMethodHeader = req.headers.get("x-auth-method");
  const authHeader = req.headers.get("authorization");
  const apiKeyId = req.headers.get("x-api-key-id");
  const apiSecret = req.headers.get("x-api-secret");

  // Debug logging
  console.log("[authenticateTenant] Auth method:", authMethodHeader || "auto");

  // 1. If explicit API key auth requested, use it directly
  if (authMethodHeader === "api-key") {
    if (!apiKeyId || !apiSecret) {
      return {
        authenticated: false,
        error: "Missing API key credentials",
      };
    }

    const result = await verifyAPIKey(apiKeyId, apiSecret);
    if (!result.valid) {
      return {
        authenticated: false,
        error: result.error || "Invalid API key",
      };
    }

    // Check for Bearer token to get user identity (standard OAuth2 pattern)
    // Mobile apps send: x-auth-method: api-key + Authorization: Bearer <portal-user-jwt>
    let userId: string | undefined = result.keyDoc?.created_by;

    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice(7);
      if (bearerToken && bearerToken !== "null" && bearerToken.trim() !== "") {
        // Try portal user token first (most common for mobile apps)
        const portalPayload = await verifyPortalUserToken(bearerToken);
        if (portalPayload) {
          // Verify tenant matches
          if (portalPayload.tenantId === result.tenantId) {
            userId = portalPayload.portalUserId;
            console.log("[authenticateTenant] API key + Bearer (portal user):", {
              tenant: result.tenantId,
              userId
            });
          } else {
            console.warn("[authenticateTenant] Bearer token tenant mismatch:", {
              apiKeyTenant: result.tenantId,
              tokenTenant: portalPayload.tenantId,
            });
          }
        }
      }
    }

    console.log("[authenticateTenant] API key auth success:", { tenant: result.tenantId, userId });
    return {
      authenticated: true,
      tenantId: result.tenantId,
      tenantDb: `vinc-${result.tenantId}`,
      userId,
      userType: "portal_user", // API key auth from mobile = portal user
      authMethod: "api-key",
    };
  }

  // 2. Check for Bearer Token authentication (JWT from SSO or Portal User)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Skip if token is literally "null" or empty
    if (token && token !== "null" && token.trim() !== "") {
      // Try SSO token first
      try {
        const payload = await validateAccessToken(token);

        if (payload) {
          console.log("[authenticateTenant] Bearer auth (SSO) success:", { tenant: payload.tenant_id, userId: payload.sub });
          return {
            authenticated: true,
            tenantId: payload.tenant_id,
            tenantDb: `vinc-${payload.tenant_id}`,
            userId: payload.sub,
            email: payload.email,
            userType: "portal_user", // JWT from mobile SSO = portal user
            authMethod: "bearer",
          };
        }
      } catch {
        // SSO validation failed, try portal user token
      }

      // Try Portal User token (used by mobile apps)
      const portalPayload = await verifyPortalUserToken(token);
      if (portalPayload) {
        console.log("[authenticateTenant] Bearer auth (portal user) success:", {
          tenant: portalPayload.tenantId,
          userId: portalPayload.portalUserId,
        });
        return {
          authenticated: true,
          tenantId: portalPayload.tenantId,
          tenantDb: `vinc-${portalPayload.tenantId}`,
          userId: portalPayload.portalUserId,
          userType: "portal_user",
          authMethod: "bearer",
        };
      }

      console.log("[authenticateTenant] Bearer token invalid - neither SSO nor portal user");
      return {
        authenticated: false,
        error: "Invalid or expired token",
      };
    }
  }

  // 3. Check for API Key authentication (implicit - without x-auth-method header)
  if (apiKeyId && apiSecret) {
    const result = await verifyAPIKey(apiKeyId, apiSecret);

    if (!result.valid) {
      return {
        authenticated: false,
        error: result.error || "Invalid API key",
      };
    }

    console.log("[authenticateTenant] API key auth (implicit) success:", { tenant: result.tenantId });
    return {
      authenticated: true,
      tenantId: result.tenantId,
      tenantDb: `vinc-${result.tenantId}`,
      userId: result.keyDoc?.created_by,
      userType: "portal_user",
      authMethod: "api-key",
    };
  }

  // 4. Fallback to B2B Session authentication
  try {
    console.log("[authenticateTenant] Trying session auth...");
    const session = await getB2BSession();

    if (session?.isLoggedIn && session?.tenantId) {
      console.log("[authenticateTenant] Session auth success:", { tenant: session.tenantId, userId: session.userId });
      return {
        authenticated: true,
        tenantId: session.tenantId,
        tenantDb: `vinc-${session.tenantId}`,
        userId: session.userId,
        email: session.email,
        userType: "portal_user", // Session = portal user (customer)
        authMethod: "session",
      };
    }

    console.log("[authenticateTenant] No valid session found");
    return {
      authenticated: false,
      error: "Authentication required",
    };
  } catch (error) {
    console.error("[authenticateTenant] Session error:", error);
    return {
      authenticated: false,
      error: "Authentication failed",
    };
  }
}

/**
 * Get tenant context from request (alias for authenticateTenant).
 * Returns null if not authenticated.
 */
export async function getTenantFromRequest(
  req: NextRequest
): Promise<{ tenantId: string; tenantDb: string; userId?: string } | null> {
  const auth = await authenticateTenant(req);

  if (!auth.authenticated || !auth.tenantId || !auth.tenantDb) {
    return null;
  }

  return {
    tenantId: auth.tenantId,
    tenantDb: auth.tenantDb,
    userId: auth.userId,
  };
}

// ============================================
// REQUIRE AUTH HELPERS
// ============================================

export interface RequireAuthOptions {
  /** Require userId to be present (default: false) */
  requireUserId?: boolean;
}

export type AuthSuccess = {
  success: true;
  tenantId: string;
  tenantDb: string;
  userId?: string;
  email?: string;
  userType?: UserType;
  authMethod: AuthMethod;
};

export type AuthFailure = {
  success: false;
  response: NextResponse;
};

/**
 * Require tenant authentication - returns auth context or 401 response.
 *
 * Centralizes the common authentication pattern used in API routes.
 *
 * @example
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const auth = await requireTenantAuth(req);
 *   if (!auth.success) return auth.response;
 *
 *   const { tenantDb, userId } = auth;
 *   // ... use tenantDb, userId
 * }
 * ```
 */
export async function requireTenantAuth(
  req: NextRequest,
  options: RequireAuthOptions = {}
): Promise<AuthSuccess | AuthFailure> {
  const { requireUserId = false } = options;

  const auth = await authenticateTenant(req);

  if (!auth.authenticated || !auth.tenantId || !auth.tenantDb) {
    return {
      success: false,
      response: NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (requireUserId && !auth.userId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "User identification required" },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    tenantId: auth.tenantId,
    tenantDb: auth.tenantDb,
    userId: auth.userId,
    email: auth.email,
    userType: auth.userType,
    authMethod: auth.authMethod!,
  };
}
