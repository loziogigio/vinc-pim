/**
 * POST /api/admin/traefik/regenerate
 *
 * Manual regeneration of Traefik dynamic config files.
 * Requires super-admin auth. Useful for recovery if auto-trigger fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { regenerateB2BConfig } from "@/lib/services/traefik-config.service";

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const result = await regenerateB2BConfig();

    return NextResponse.json({
      success: true,
      b2b: {
        domains_count: result.domains_count,
        file_path: result.file_path,
      },
    });
  } catch (error) {
    console.error("[traefik] Regeneration error:", error);
    const message = error instanceof Error ? error.message : "Failed to regenerate config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
