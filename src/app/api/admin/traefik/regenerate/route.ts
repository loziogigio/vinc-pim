/**
 * POST /api/admin/traefik/regenerate
 *
 * Manual regeneration of Traefik dynamic config files (B2B + B2C).
 * Requires super-admin auth. Useful for recovery if auto-trigger fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { regenerateB2BConfig, regenerateB2CConfig } from "@/lib/services/traefik-config.service";

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const [b2bResult, b2cResult] = await Promise.all([
      regenerateB2BConfig(),
      regenerateB2CConfig(),
    ]);

    return NextResponse.json({
      success: true,
      b2b: {
        domains_count: b2bResult.domains_count,
        file_path: b2bResult.file_path,
      },
      b2c: {
        domains_count: b2cResult.domains_count,
        file_path: b2cResult.file_path,
      },
    });
  } catch (error) {
    console.error("[traefik] Regeneration error:", error);
    const message = error instanceof Error ? error.message : "Failed to regenerate config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
