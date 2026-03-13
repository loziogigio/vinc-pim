/**
 * POST /api/b2b/pricing/prices
 *
 * Main pricing endpoint — vinc-b2b calls this (via PIM proxy).
 * Resolves prices through the tenant's configured pricing provider.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { resolvePrices } from "@/lib/pricing/pricing.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();
    const { entity_codes, quantity_list, customer_code, address_code, id_cart } =
      body;

    if (!Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    const result = await resolvePrices(tenantDb, tenantId, {
      entity_codes,
      quantity_list: quantity_list ?? new Array(entity_codes.length).fill(1),
      customer_code: customer_code ?? "",
      address_code: address_code ?? "",
      id_cart: id_cart ?? "",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[POST /api/b2b/pricing/prices] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
