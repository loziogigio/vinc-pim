/**
 * Quotation Actions API
 *
 * POST /api/b2b/orders/[id]/quotation?action=send|accept|reject|revise|counter
 *
 * Handles all quotation-related actions:
 * - send: Send quotation to customer
 * - accept: Customer accepts quotation
 * - reject: Customer rejects quotation
 * - revise: Sales team creates revision
 * - counter: Customer creates counter-offer
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  sendQuotation,
  acceptQuotation,
  rejectQuotation,
  createRevision,
} from "@/lib/services/order-lifecycle.service";
import type { AdjustmentReason } from "@/lib/constants/order";
import { nanoid } from "nanoid";

interface CartDiscountInput {
  type: "percentage" | "fixed";
  value: number;
  reason: AdjustmentReason;
  description?: string;
}

interface LineAdjustmentInput {
  line_number: number;
  type: "price_override" | "discount_percentage" | "discount_fixed";
  new_value: number;
  reason: AdjustmentReason;
  description?: string;
}

interface RevisionBody {
  cart_discounts?: CartDiscountInput[];
  line_adjustments?: LineAdjustmentInput[];
  items_added?: number[];
  items_removed?: number[];
  items_qty_changed?: Array<{ line_number: number; old_qty: number; new_qty: number }>;
  notes?: string;
  internal_notes?: string;
}

interface RejectBody {
  reason?: string;
}

interface SendBody {
  message?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter required (send, accept, reject, revise, counter)" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const userId = auth.userId || "anonymous";

    let result;

    switch (action) {
      case "send": {
        const body: SendBody = await req.json().catch(() => ({}));
        result = await sendQuotation(connection, orderId, userId, body.message);
        break;
      }

      case "accept": {
        result = await acceptQuotation(connection, orderId, userId);
        break;
      }

      case "reject": {
        const body: RejectBody = await req.json().catch(() => ({}));
        result = await rejectQuotation(connection, orderId, userId, body.reason);
        break;
      }

      case "revise": {
        const body: RevisionBody = await req.json().catch(() => ({}));
        result = await createRevision(
          connection,
          orderId,
          userId,
          auth.userName || "Sales",
          "sales",
          {
            cartDiscountsAdded: body.cart_discounts?.map((d) => ({
              discount_id: nanoid(8),
              type: d.type,
              value: d.value,
              reason: d.reason,
              description: d.description,
              applied_by: userId,
              applied_at: new Date(),
            })),
            lineAdjustmentsAdded: body.line_adjustments?.map((a) => ({
              adjustment_id: nanoid(8),
              line_number: a.line_number,
              type: a.type,
              original_value: 0, // Will be filled by service
              new_value: a.new_value,
              reason: a.reason,
              description: a.description,
              applied_by: userId,
              applied_at: new Date(),
            })),
            itemsAdded: body.items_added,
            itemsRemoved: body.items_removed,
            itemsQtyChanged: body.items_qty_changed,
            notes: body.notes,
            internalNotes: body.internal_notes,
          }
        );
        break;
      }

      case "counter": {
        const body: RevisionBody = await req.json().catch(() => ({}));
        result = await createRevision(
          connection,
          orderId,
          userId,
          auth.userName || "Customer",
          "customer",
          {
            cartDiscountsAdded: body.cart_discounts?.map((d) => ({
              discount_id: nanoid(8),
              type: d.type,
              value: d.value,
              reason: d.reason,
              description: d.description,
              applied_by: userId,
              applied_at: new Date(),
            })),
            lineAdjustmentsAdded: body.line_adjustments?.map((a) => ({
              adjustment_id: nanoid(8),
              line_number: a.line_number,
              type: a.type,
              original_value: 0,
              new_value: a.new_value,
              reason: a.reason,
              description: a.description,
              applied_by: userId,
              applied_at: new Date(),
            })),
            itemsAdded: body.items_added,
            itemsRemoved: body.items_removed,
            itemsQtyChanged: body.items_qty_changed,
            notes: body.notes,
          }
        );
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      order: result.order,
    });
  } catch (error) {
    console.error("Error processing quotation action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process quotation action" },
      { status: 500 }
    );
  }
}
