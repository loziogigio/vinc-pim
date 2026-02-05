/**
 * POST /api/b2b/orders/[id]/to-quotation
 *
 * Convert a draft order (cart) to a quotation for negotiation.
 * Transitions: draft → quotation
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { convertToQuotation } from "@/lib/services/order-lifecycle.service";

interface RequestBody {
  days_valid?: number;
  notes?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: RequestBody = await req.json().catch(() => ({}));

    const result = await convertToQuotation(
      connection,
      orderId,
      auth.userId || "system",
      {
        daysValid: body.days_valid,
        notes: body.notes,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      quotation_number: result.order?.quotation?.quotation_number,
    });
  } catch (error) {
    console.error("Error converting to quotation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to convert to quotation" },
      { status: 500 }
    );
  }
}
