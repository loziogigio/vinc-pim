/**
 * Shared authentication helper for Documents API routes.
 *
 * Supports both B2B session (cookie) and API key authentication.
 */

import { NextRequest } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

export interface DocumentAuthResult {
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  userId?: string;
  username?: string;
  error?: string;
  statusCode?: number;
}

export async function authenticateDocumentRequest(
  req: NextRequest,
): Promise<DocumentAuthResult> {
  const authMethod = req.headers.get("x-auth-method");

  if (authMethod === "api-key") {
    const result = await verifyAPIKeyFromRequest(req, "documents");
    if (!result.authenticated) {
      return {
        authenticated: false,
        error: result.error,
        statusCode: result.statusCode,
      };
    }
    return {
      authenticated: true,
      tenantId: result.tenantId!,
      tenantDb: result.tenantDb!,
      userId: "api-key",
      username: "API",
    };
  }

  const session = await getB2BSession();
  if (!session || !session.isLoggedIn || !session.tenantId) {
    return { authenticated: false, error: "Unauthorized", statusCode: 401 };
  }

  return {
    authenticated: true,
    tenantId: session.tenantId,
    tenantDb: `vinc-${session.tenantId}`,
    userId: session.userId,
    username: session.username,
  };
}
