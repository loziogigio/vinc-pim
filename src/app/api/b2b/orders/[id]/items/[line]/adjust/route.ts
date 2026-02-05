/**
 * Line Item Adjustment API
 *
 * POST /api/b2b/orders/[id]/items/[line]/adjust - Add line adjustment
 * DELETE /api/b2b/orders/[id]/items/[line]/adjust?adjustment_id=xxx - Remove adjustment
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  addLineAdjustment,
  removeLineAdjustment,
} from "@/lib/services/order-lifecycle.service";
import type { AdjustmentReason } from "@/lib/constants/order";

interface AddAdjustmentBody {
  type: "price_override" | "discount_percentage" | "discount_fixed";
  new_value: number;
  reason: AdjustmentReason;
  description?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; line: string }> }
) {
  try {
    const { id: orderId, line } = await params;
    const lineNumber = parseInt(line, 10);

    if (isNaN(lineNumber)) {
      return NextResponse.json(
        { error: "Invalid line number" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: AddAdjustmentBody = await req.json();

    if (!body.type || body.new_value === undefined || !body.reason) {
      return NextResponse.json(
        { error: "type, new_value, and reason are required" },
        { status: 400 }
      );
    }

    const result = await addLineAdjustment(
      connection,
      orderId,
      lineNumber,
      auth.userId || "system",
      {
        type: body.type,
        newValue: body.new_value,
        reason: body.reason,
        description: body.description,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error adding line adjustment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add adjustment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; line: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { searchParams } = new URL(req.url);
    const adjustmentId = searchParams.get("adjustment_id");

    if (!adjustmentId) {
      return NextResponse.json(
        { error: "adjustment_id query parameter required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await removeLineAdjustment(connection, orderId, adjustmentId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error removing line adjustment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove adjustment" },
      { status: 500 }
    );
  }
}
