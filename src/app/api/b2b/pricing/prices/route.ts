/**
 * POST /api/b2b/pricing/prices
 *
 * Main pricing endpoint — vinc-b2b calls this (via PIM proxy).
 * Resolves prices through the tenant's configured pricing provider.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { resolvePrices } from "@/lib/pricing/pricing.service";
import { runBeforeHook, runOnHook, runAfterHook } from "@/lib/services/windmill-proxy.service";
import type { HookContext } from "@/lib/types/windmill-proxy";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();
    const { entity_codes, quantity_list, customer_code, address_code, id_cart, channel } =
      body;

    if (!Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    const ch = channel || "default";
    const hookCtx: HookContext = {
      tenantDb,
      tenantId,
      channel: ch,
      operation: "pricing.resolve",
      entityCodes: entity_codes,
      customerCode: customer_code,
      addressCode: address_code,
      requestData: body as Record<string, unknown>,
    };

    // ── BEFORE HOOK: validate/transform the pricing request ──
    const before = await runBeforeHook(hookCtx);
    if (before.hooked && !before.allowed) {
      return NextResponse.json(
        { error: before.message || "Pricing request rejected", windmill: { phase: "before", blocked: true } },
        { status: 422 },
      );
    }

    // ── ON HOOK: if configured, Windmill IS the pricing provider ──
    const on = await runOnHook(hookCtx);
    if (on.hooked && on.success && on.response?.data) {
      // Windmill returned prices — use them directly
      runAfterHook(hookCtx);
      return NextResponse.json({
        ...on.response.data,
        windmill: {
          channel: ch,
          before: before.hooked ? { allowed: before.allowed } : undefined,
          on: { synced: true },
        },
      });
    }

    // Fallback: use existing provider (legacy_erp / generic_http)
    const result = await resolvePrices(tenantDb, tenantId, {
      entity_codes,
      quantity_list: quantity_list ?? new Array(entity_codes.length).fill(1),
      customer_code: customer_code ?? "",
      address_code: address_code ?? "",
      id_cart: id_cart ?? "",
    });

    // ── AFTER HOOK: fire-and-forget ──
    runAfterHook(hookCtx);

    return NextResponse.json({
      ...result,
      ...(before.hooked || on.hooked ? {
        windmill: {
          channel: ch,
          before: before.hooked ? { allowed: before.allowed } : undefined,
          on: on.hooked ? { synced: on.success, timed_out: on.timedOut } : undefined,
        },
      } : {}),
    });
  } catch (err: any) {
    console.error("[POST /api/b2b/pricing/prices] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
