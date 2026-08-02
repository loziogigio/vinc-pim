import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection-pool";
import { createResourceQuotationOption } from "@/lib/services/resource-quotation.service";
import type { OCPassenger } from "@/lib/oc-api/types";

interface OptionRequestBody {
  passengers?: OCPassenger[];
}

/**
 * Turn an existing quotation's cruise line into a real MSC cabin OPTION.
 *
 * POST /api/b2b/resource-quotations/{token}/option
 * Body: { passengers: OCPassenger[] }
 * Success (200): { success: true, data: { booking_no, order_uuid, cabin_no, status } }
 * Failure: { error: string, oc?: <raw OC order payload> } with the upstream status
 *          (404 quotation not found, 400/422 cannot resolve cabin/price type,
 *          502 OC call failed or returned a non-confirmed/offline order).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  let body: OptionRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.passengers || body.passengers.length === 0) {
    return NextResponse.json(
      { error: "passengers array must not be empty" },
      { status: 400 }
    );
  }

  const tenantDbConn = await getPooledConnection(auth.tenantDb);
  const result = await createResourceQuotationOption(
    tenantDbConn,
    auth.tenantId!,
    token,
    body.passengers
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to book MSC option", oc: result.ocPayload },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
