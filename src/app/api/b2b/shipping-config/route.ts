import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import {
  fetchShippingConfig,
  saveShippingConfig,
} from "@/lib/services/delivery-cost.service";
import type { IShippingZone } from "@/lib/types/shipping";

/**
 * GET /api/b2b/shipping-config
 * Returns the tenant's shipping zone and method configuration.
 * Returns { zones: [] } if not yet configured.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const config = await fetchShippingConfig(tenantDb);

    return NextResponse.json({
      success: true,
      data: config ?? { zones: [] },
    });
  } catch (error) {
    console.error("GET /api/b2b/shipping-config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping configuration" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/b2b/shipping-config
 * Replace the tenant's full shipping configuration.
 *
 * Body: { zones: IShippingZone[] }
 *
 * Validation:
 *   - Each method must have at least one tier with min_subtotal: 0
 *   - Each zone must have at least one country code
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { zones } = body as { zones: IShippingZone[] };

    if (!Array.isArray(zones)) {
      return NextResponse.json(
        { error: "zones must be an array" },
        { status: 400 }
      );
    }

    // Validate each method has a base tier (min_subtotal: 0)
    for (const zone of zones) {
      if (!zone.name?.trim()) {
        return NextResponse.json(
          { error: "Each zone must have a name" },
          { status: 400 }
        );
      }
      if (!Array.isArray(zone.countries) || zone.countries.length === 0) {
        return NextResponse.json(
          { error: `Zone "${zone.name}" must have at least one country code` },
          { status: 400 }
        );
      }
      for (const method of zone.methods ?? []) {
        if (!method.name?.trim()) {
          return NextResponse.json(
            { error: "Each shipping method must have a name" },
            { status: 400 }
          );
        }
        const tiers = method.tiers ?? [];
        if (tiers.length === 0 || !tiers.some((t) => t.min_subtotal === 0)) {
          return NextResponse.json(
            {
              error: `Method "${method.name}" in zone "${zone.name}" must have at least one tier with min_subtotal: 0`,
            },
            { status: 400 }
          );
        }
      }
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const saved = await saveShippingConfig(tenantDb, { zones });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("PUT /api/b2b/shipping-config error:", error);
    return NextResponse.json(
      { error: "Failed to save shipping configuration" },
      { status: 500 }
    );
  }
}
