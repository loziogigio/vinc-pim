/**
 * POST /api/b2b/settings/windmill-proxy/preview-payload
 *
 * Returns the exact payload Windmill would receive for a given order + operation,
 * WITHOUT actually calling Windmill. Use this to develop/test scripts locally.
 *
 * Body:
 *   - order_id: string (required)
 *   - operation: string (default "order.submit")
 *   - phase: string (default "on")
 *   - autofix?: boolean
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { getProxySettings, findHook } from "@/lib/services/windmill-proxy.service";
import type { HookPhase, HookOperation } from "@/lib/types/windmill-proxy";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantId } = auth;
  const dbName = `vinc-${tenantId}`;

  const body = await req.json().catch(() => ({}));
  const orderId = body.order_id;
  const operation = (body.operation || "order.submit") as HookOperation;
  const phase = (body.phase || "on") as HookPhase;

  if (!orderId) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }

  const { Order } = await connectWithModels(dbName);
  const order = await Order.findOne({ order_id: orderId }).lean();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Build the exact payload that buildPayload() would create
  const payload = {
    operation,
    phase,
    tenant_id: tenantId,
    channel: (order as any).channel || "default",
    timestamp: new Date().toISOString(),
    customer_code: (order as any).customer_code,
    address_code: (order as any).shipping_address_code,
    order_id: orderId,
    order,
    entity_codes: undefined,
    customer_id: undefined,
    request_data: body.autofix ? { autofix: true } : undefined,
  };

  // Also show which hook would match
  const settings = await getProxySettings(dbName);
  const hook = settings
    ? findHook(settings, payload.channel, operation, phase)
    : undefined;

  return NextResponse.json({
    success: true,
    hook_match: hook
      ? { script_path: hook.script_path, blocking: hook.blocking, timeout_ms: hook.timeout_ms }
      : null,
    payload,
  });
}
