/**
 * POST /api/b2b/windmill/sso
 *
 * SSO login proxy for Windmill. Authenticates the current user's
 * mapped Windmill credentials server-side and returns a session token.
 * Only available when windmill proxy is enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { windmillLogin, WindmillError } from "@/lib/services/windmill-client";
import { decrypt } from "@/lib/utils/encryption";
import type { WindmillProxySettings } from "@/lib/types/windmill-proxy";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb } = auth;
  const { HomeSettings } = await connectWithModels(tenantDb);
  const home = await HomeSettings.findOne({}).lean();

  const proxy = (home as any)?.windmill_proxy as WindmillProxySettings | undefined;
  if (!proxy?.enabled) {
    return NextResponse.json({ error: "Windmill is not enabled" }, { status: 404 });
  }

  const mapping = proxy.sso_users?.[0];
  if (!mapping) {
    return NextResponse.json(
      { error: "No Windmill SSO account configured" },
      { status: 403 },
    );
  }

  try {
    const password = decrypt(mapping.windmill_password_encrypted);
    const baseUrl = process.env.WINDMILL_BASE_URL || proxy.windmill_base_url || "http://windmill:8000";
    const token = await windmillLogin(mapping.windmill_email, password, baseUrl);

    const externalUrl = process.env.WINDMILL_EXTERNAL_URL || proxy.windmill_external_url || baseUrl;
    const ws = proxy.workspace_name || process.env.WINDMILL_WORKSPACE;

    return NextResponse.json({
      success: true,
      token,
      windmill_url: ws
        ? `${externalUrl}/w/${ws}?token=${encodeURIComponent(token)}`
        : `${externalUrl}?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    console.error("[Windmill SSO] Login failed:", error);
    const msg = error instanceof WindmillError
      ? `Windmill login failed (${error.status})`
      : "SSO login failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
