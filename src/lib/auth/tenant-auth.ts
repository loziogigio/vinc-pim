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
 *   Authorization: Bearer <access-token>   // SSO access token for user identity
 * ```
 *
 * The Bearer token can be either:
 * - SSO access token (from /api/auth/token) - uses tenant_id, sub (userId)
 * - Portal user token (legacy) - uses tenantId, portalUserId
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "./b2b-session";
import { verifyAPIKey } from "./api-key-auth";
import { validateAccessToken } from "@/lib/sso/tokens";
import { verifyPortalUserToken } from "./portal-user-token";
import { getSSOSessionModel } from "@/lib/db/models/sso-session";

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

    // Check for B2B user identification headers
    // B2B mobile apps send: x-user-type: b2b_user + x-customer-id: <customer_id>
    const b2bUserType = req.headers.get("x-user-type");
    const customerId = req.headers.get("x-customer-id");

    if (b2bUserType === "b2b_user" && customerId) {
      console.log("[authenticateTenant] API key + B2B user:", {
        tenant: result.tenantId,
        customerId,
      });
      return {
        authenticated: true,
        tenantId: result.tenantId,
        tenantDb: `vinc-${result.tenantId}`,
        userId: customerId, // Use customer_id as userId for B2B users
        userType: "b2b_user",
        authMethod: "api-key",
      };
    }

    // Check for Bearer token to get user identity (standard OAuth2 pattern)
    // Mobile apps send: x-auth-method: api-key + Authorization: Bearer <token>
    // Token can be either: SSO access token (tenant_id, sub) or portal user token (tenantId, portalUserId)
    let userId: string | undefined = result.keyDoc?.created_by;
    let email: string | undefined;
    let userType: UserType = "portal_user";

    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice(7);
      if (bearerToken && bearerToken !== "null" && bearerToken.trim() !== "") {
        // Try SSO access token first (most common after OAuth login)
        const ssoPayload = await validateAccessToken(bearerToken);
        if (ssoPayload && ssoPayload.tenant_id === result.tenantId) {
          userId = ssoPayload.sub;
          email = ssoPayload.email;

          // Check if user has customers in session (B2B user)
          // SSO users with customers are B2B users
          try {
            const SSOSession = await getSSOSessionModel();
            const session = await SSOSession.findBySessionId(ssoPayload.session_id);
            console.log("[authenticateTenant] SSO session lookup:", {
              sessionId: ssoPayload.session_id,
              found: !!session,
              hasCustomers: session?.vinc_profile?.customers?.length || 0
            });
            if (session?.vinc_profile?.customers?.length > 0) {
              userType = "b2b_user";
            }
          } catch (err) {
            console.warn("[authenticateTenant] SSO session lookup failed:", err);
            // Fallback: SSO users are typically B2B users
            // If they came through SSO login, they're likely B2B
            userType = "b2b_user";
          }

          console.log("[authenticateTenant] API key + Bearer (SSO token):", {
            tenant: result.tenantId,
            userId,
            userType
          });
        } else {
          // Try portal user token (legacy or custom auth)
          const portalPayload = await verifyPortalUserToken(bearerToken);
          if (portalPayload && portalPayload.tenantId === result.tenantId) {
            userId = portalPayload.portalUserId;
            console.log("[authenticateTenant] API key + Bearer (portal user):", {
              tenant: result.tenantId,
              userId
            });
          } else if (ssoPayload || portalPayload) {
            // Token valid but tenant mismatch
            console.warn("[authenticateTenant] Bearer token tenant mismatch:", {
              apiKeyTenant: result.tenantId,
              tokenTenant: ssoPayload?.tenant_id || portalPayload?.tenantId,
            });
          }
        }
      }
    }

    console.log("[authenticateTenant] API key auth success:", { tenant: result.tenantId, userId, userType });
    return {
      authenticated: true,
      tenantId: result.tenantId,
      tenantDb: `vinc-${result.tenantId}`,
      userId,
      email,
      userType,
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
          // Check if user has customers in session (B2B user)
          let userType: UserType = "portal_user";
          try {
            const SSOSession = await getSSOSessionModel();
            const session = await SSOSession.findBySessionId(payload.session_id);
            console.log("[authenticateTenant] SSO session lookup (Bearer):", {
              sessionId: payload.session_id,
              found: !!session,
              hasCustomers: session?.vinc_profile?.customers?.length || 0
            });
            if (session?.vinc_profile?.customers?.length > 0) {
              userType = "b2b_user";
            }
          } catch (err) {
            console.warn("[authenticateTenant] SSO session lookup failed (Bearer):", err);
            // Fallback: SSO users are typically B2B users
            userType = "b2b_user";
          }

          console.log("[authenticateTenant] Bearer auth (SSO) success:", {
            tenant: payload.tenant_id,
            userId: payload.sub,
            userType
          });
          return {
            authenticated: true,
            tenantId: payload.tenant_id,
            tenantDb: `vinc-${payload.tenant_id}`,
            userId: payload.sub,
            email: payload.email,
            userType,
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
