/**
 * POST /api/b2b/settings/windmill-proxy/test
 *
 * Test Windmill connectivity for the tenant's workspace.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { windmillRun, windmillCreateFolder, WindmillError } from "@/lib/services/windmill-client";
import { getProxySettings } from "@/lib/services/windmill-proxy.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const folderName = `vinc_${tenantId.replace(/-/g, "_")}`;
    const scriptPath = body.script_path || `f/${folderName}/echo`;
    const settings = await getProxySettings(tenantDb);
    const baseUrl = settings?.windmill_base_url || process.env.WINDMILL_BASE_URL || undefined;
    const timeout = settings?.timeout_ms || 5000;
    const workspace = settings?.workspace_name || process.env.WINDMILL_WORKSPACE || "";

    // Ensure the tenant folder and echo script exist before testing
    if (!body.script_path) {
      await windmillCreateFolder(tenantId, baseUrl, workspace);
    }

    const result = await windmillRun(
      workspace,
      scriptPath,
      { test: true, timestamp: new Date().toISOString() },
      timeout,
      baseUrl,
    );

    return NextResponse.json({
      success: true,
      message: "Windmill connection successful",
      workspace,
      script_path: scriptPath,
      result,
    });
  } catch (error) {
    const isWindmillError = error instanceof WindmillError;
    return NextResponse.json({
      success: false,
      message: isWindmillError
        ? `Windmill error (${(error as WindmillError).status}): ${error.message}`
        : `Connection failed: ${(error as Error).message}`,
      status: isWindmillError ? (error as WindmillError).status : 502,
    }, { status: 200 }); // Return 200 so frontend can read the error details
  }
}
