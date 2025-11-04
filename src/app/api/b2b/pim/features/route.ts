import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { FeatureModel } from "@/lib/db/models/feature";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/pim/features
 * Get all technical features
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query
    const query: any = {
      wholesaler_id: session.userId,
    };

    if (!includeInactive) {
      query.is_active = true;
    }

    const features = await FeatureModel.find(query)
      .sort({ display_order: 1, label: 1 })
      .lean();

    return NextResponse.json({ features });
  } catch (error) {
    console.error("Error fetching features:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/features
 * Create a new technical feature
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { key, label, type, unit, options, default_required, display_order } = body;

    if (!key || !label || !type) {
      return NextResponse.json(
        { error: "Key, label, and type are required" },
        { status: 400 }
      );
    }

    // Check if key already exists for this wholesaler
    const existing = await FeatureModel.findOne({
      wholesaler_id: session.userId,
      key,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A feature with this key already exists" },
        { status: 400 }
      );
    }

    const feature = await FeatureModel.create({
      feature_id: nanoid(12),
      wholesaler_id: session.userId,
      key,
      label,
      type,
      unit,
      options: options || [],
      default_required: default_required || false,
      display_order: display_order || 0,
      is_active: true,
    });

    return NextResponse.json({ feature }, { status: 201 });
  } catch (error) {
    console.error("Error creating feature:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
