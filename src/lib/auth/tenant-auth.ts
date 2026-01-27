/**
 * Unified Tenant Authentication
 *
 * Supports multiple authentication methods:
 * 1. Bearer Token (JWT from SSO)
 * 2. API Key (header-based)
 * 3. B2B Session (cookie-based)
 *
 * Use this for endpoints that need to be accessible from multiple clients.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "./b2b-session";
import { verifyAPIKey } from "./api-key-auth";
import { validateAccessToken } from "@/lib/sso/tokens";

// ============================================
// TYPES
// ============================================

export type AuthMethod = "bearer" | "session" | "api-key";

export interface TenantAuthResult {
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  userId?: string;
  email?: string;
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
  // Debug: log incoming auth headers
  const authHeader = req.headers.get("authorization");
  console.log("[authenticateTenant] Auth header:", authHeader ? `Bearer ${authHeader.slice(7, 20)}...` : "none");

  // 1. Check for Bearer Token authentication (JWT from SSO)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await validateAccessToken(token);

      if (payload) {
        console.log("[authenticateTenant] Bearer auth success:", { tenant: payload.tenant_id, userId: payload.sub });
        return {
          authenticated: true,
          tenantId: payload.tenant_id,
          tenantDb: `vinc-${payload.tenant_id}`,
          userId: payload.sub, // user_id is in 'sub' field
          email: payload.email,
          authMethod: "bearer",
        };
      }
      console.log("[authenticateTenant] Bearer token invalid - no payload");
    } catch (error) {
      console.error("[authenticateTenant] Bearer token error:", error);
    }

    return {
      authenticated: false,
      error: "Invalid or expired token",
    };
  }

  // 2. Check for API Key authentication
  const authMethodHeader = req.headers.get("x-auth-method");
  const apiKeyId = req.headers.get("x-api-key-id");
  const apiSecret = req.headers.get("x-api-secret");

  if (authMethodHeader === "api-key" || (apiKeyId && apiSecret)) {
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

    return {
      authenticated: true,
      tenantId: result.tenantId,
      tenantDb: `vinc-${result.tenantId}`,
      userId: result.keyDoc?.created_by,
      authMethod: "api-key",
    };
  }

  // 3. Fallback to B2B Session authentication
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
    authMethod: auth.authMethod!,
  };
}
