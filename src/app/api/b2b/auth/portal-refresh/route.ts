/**
 * Portal User Token Refresh API
 *
 * POST /api/b2b/auth/portal-refresh
 *
 * Refreshes a portal user JWT token with fresh customer tags.
 * Requires valid API key authentication + current Bearer token.
 *
 * Use case: mobile app calls this on launch to pick up tag changes
 * made by admin since last login.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  verifyPortalUserToken,
  generatePortalUserToken,
} from "@/lib/auth/portal-user-token";
import { connectWithModels } from "@/lib/db/connection";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify API key (app-level authentication)
    const apiKeyResult = await verifyAPIKeyFromRequest(req);
    if (!apiKeyResult.authenticated) {
      return NextResponse.json(
        { error: apiKeyResult.error || "API key authentication required" },
        { status: apiKeyResult.statusCode || 401 }
      );
    }

    const tenantId = apiKeyResult.tenantId!;
    const tenantDb = apiKeyResult.tenantDb!;

    // 2. Extract and verify Bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Bearer token required" },
        { status: 401 }
      );
    }

    const currentToken = authHeader.slice(7);
    const payload = await verifyPortalUserToken(currentToken);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // 3. Verify tenant matches
    if (payload.tenantId !== tenantId) {
      return NextResponse.json(
        { error: "Token tenant mismatch" },
        { status: 403 }
      );
    }

    // 4. Connect and verify user still exists and is active
    const { PortalUser: PortalUserModel, Customer: CustomerModel } =
      await connectWithModels(tenantDb);

    const user = await PortalUserModel.findOne({
      portal_user_id: payload.portalUserId,
      tenant_id: tenantId,
      is_active: true,
    }).lean();

    if (!user) {
      return NextResponse.json(
        { error: "User not found or inactive" },
        { status: 401 }
      );
    }

    // 5. Re-fetch customer tags from DB
    const customerIds = ((user as any).customer_access || []).map(
      (ca: any) => ca.customer_id
    );
    let customerTags: string[] = [];
    if (customerIds.length) {
      const customers = await CustomerModel.find(
        { customer_id: { $in: customerIds } },
        { tags: 1 }
      ).lean();
      customerTags = [
        ...new Set(
          customers
            .flatMap((c: any) => (c.tags || []).map((t: any) => t.full_tag))
            .filter(Boolean)
        ),
      ];
    }

    // 6. Generate new JWT with fresh tags
    const token = await generatePortalUserToken(
      payload.portalUserId,
      tenantId,
      customerTags
    );

    return NextResponse.json({
      token,
      customer_tags: customerTags,
    });
  } catch (error) {
    console.error("Portal refresh error:", error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
