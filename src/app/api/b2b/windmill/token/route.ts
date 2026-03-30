/**
 * POST /api/b2b/windmill/token
 *
 * SSO token exchange for Windmill UI access.
 * Creates/returns a Windmill user token for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { windmillCreateUserToken, WindmillError } from "@/lib/services/windmill-client";
import { getProxySettings } from "@/lib/services/windmill-proxy.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const settings = await getProxySettings(tenantDb);
    const baseUrl = settings?.windmill_base_url || process.env.WINDMILL_BASE_URL || "http://windmill:8000";
    const workspace = settings?.workspace_name || process.env.WINDMILL_WORKSPACE || "";

    // Use user's email from auth if available, fallback to userId
    const email = auth.email || `${auth.userId}@vinc.local`;

    const token = await windmillCreateUserToken(workspace, email, baseUrl);

    return NextResponse.json({
      success: true,
      token,
      windmill_url: `${baseUrl}/user/workspaces`,
      workspace,
    });
  } catch (error) {
    console.error("[Windmill Token] Error:", error);
    const isWindmillError = error instanceof WindmillError;
    return NextResponse.json(
      {
        error: isWindmillError
          ? `Windmill error: ${error.message}`
          : "Failed to create Windmill token",
      },
      { status: isWindmillError ? (error as WindmillError).status : 500 },
    );
  }
}
