/**
 * Admin Authentication Utilities
 *
 * Helper functions for authenticating super admin requests.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, JWTPayload } from "jose";
import { getSuperAdminModel, ISuperAdminDocument } from "@/lib/db/models/super-admin";

const JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || "super-admin-secret-change-me";
const COOKIE_NAME = "admin_session";

export interface AdminAuthResult {
  admin: ISuperAdminDocument;
  payload: JWTPayload;
}

/**
 * Verify admin authentication from request.
 * Returns the admin document if authenticated, null otherwise.
 */
export async function verifyAdminAuth(req: NextRequest): Promise<AdminAuthResult | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (!payload.sub) {
      return null;
    }

    const SuperAdminModel = await getSuperAdminModel();
    const admin = await SuperAdminModel.findById(payload.sub);

    if (!admin || !admin.is_active) {
      return null;
    }

    return { admin, payload };
  } catch {
    return null;
  }
}

/**
 * Create an unauthorized response.
 */
export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Middleware wrapper for admin-protected routes.
 * Use this to wrap route handlers that require admin authentication.
 */
export function withAdminAuth<T extends unknown[]>(
  handler: (req: NextRequest, auth: AdminAuthResult, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const auth = await verifyAdminAuth(req);

    if (!auth) {
      return unauthorizedResponse();
    }

    return handler(req, auth, ...args);
  };
}
