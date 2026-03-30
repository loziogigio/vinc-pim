/**
 * POST /api/b2b/cruises/sync — Trigger cruise data sync from OC aggregator
 *
 * Syncs brands, categories, ship products, cabin products, and departures.
 * Requires API key auth with "import" permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { syncAll, syncReferenceData, syncDepartures } from "@/lib/services/cruise-sync.service";

async function authenticate(req: NextRequest) {
  const authMethod = req.headers.get("x-auth-method");

  if (authMethod === "api-key") {
    const result = await verifyAPIKeyFromRequest(req, "import");
    if (!result.authenticated) {
      return { error: result.error || "Unauthorized", status: result.statusCode || 401 };
    }
    return { tenantId: result.tenantId!, tenantDb: result.tenantDb! };
  }

  const session = await getB2BSession();
  if (!session?.isLoggedIn || !session.tenantId) {
    return { error: "Unauthorized", status: 401 };
  }
  return { tenantId: session.tenantId, tenantDb: `vinc-${session.tenantId}` };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const phase = searchParams.get("phase") || "all";

    let result;
    switch (phase) {
      case "reference":
        result = await syncReferenceData(auth.tenantDb, auth.tenantId);
        break;
      case "departures":
        result = await syncDepartures(auth.tenantDb, auth.tenantId);
        break;
      case "all":
      default:
        result = await syncAll(auth.tenantDb, auth.tenantId);
        break;
    }

    return NextResponse.json({ success: true, phase, result });
  } catch (error: unknown) {
    console.error("[cruise-sync] Error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: (error as Error).message },
      { status: 500 },
    );
  }
}
