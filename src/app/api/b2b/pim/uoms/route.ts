import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/pim/uoms
 * Get all units of measurement
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { UOM } = await connectWithModels(tenantDb);

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";
    const category = searchParams.get("category");

    // Build query
    const query: any = {
      // No wholesaler_id - database provides isolation
    };

    if (!includeInactive) {
      query.is_active = true;
    }

    if (category) {
      query.category = category;
    }

    const uoms = await UOM.find(query)
      .sort({ category: 1, display_order: 1, symbol: 1 })
      .lean();

    return NextResponse.json({ uoms });
  } catch (error) {
    console.error("Error fetching UOMs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/uoms
 * Create a new unit of measurement
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { UOM } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { symbol, name, category, display_order } = body;

    if (!symbol || !name) {
      return NextResponse.json(
        { error: "Symbol and name are required" },
        { status: 400 }
      );
    }

    // Check if symbol already exists (case-insensitive)
    const existing = await UOM.findOne({
      // No wholesaler_id - database provides isolation
      symbol: { $regex: new RegExp(`^${symbol}$`, "i") },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A UOM with this symbol already exists" },
        { status: 400 }
      );
    }

    const uom = await UOM.create({
      uom_id: nanoid(12),
      // No wholesaler_id - database provides isolation
      symbol: symbol.trim(),
      name: name.trim(),
      category: category || "other",
      display_order: display_order || 0,
      is_active: true,
    });

    return NextResponse.json({ uom }, { status: 201 });
  } catch (error) {
    console.error("Error creating UOM:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
