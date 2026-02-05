/**
 * My Tenant API
 *
 * GET /api/b2b/users/my-tenant - Get the tenant the authenticated user has access to
 *
 * This endpoint allows a user to discover which tenant they belong to.
 * The tenant_id is extracted directly from the SSO access token payload.
 *
 * Authentication: Bearer token (SSO access token)
 *
 * Response:
 * {
 *   tenant_id: string,
 *   tenant_name: string,
 *   access_type: "b2b_admin",
 *   profile: {
 *     user_id: string,
 *     email: string,
 *     role: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken } from "@/lib/sso/tokens";
import { getTenantModel } from "@/lib/db/models/admin-tenant";

export async function GET(req: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Validate the SSO access token
    const payload = await validateAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Extract tenant_id from token payload
    const { sub: userId, tenant_id: tenantId, email, role } = payload;

    if (!tenantId) {
      return NextResponse.json(
        { error: "Token does not contain tenant_id" },
        { status: 400 }
      );
    }

    // Look up tenant name from admin database
    const Tenant = await getTenantModel();
    const tenant = await Tenant.findOne({ tenant_id: tenantId, status: "active" })
      .select("tenant_id name")
      .lean();

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found or inactive" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.name,
      access_type: "b2b_admin",
      profile: {
        user_id: userId,
        email,
        role,
      },
    });
  } catch (error) {
    console.error("Error getting user tenant:", error);
    return NextResponse.json(
      { error: "Failed to get tenant" },
      { status: 500 }
    );
  }
}
