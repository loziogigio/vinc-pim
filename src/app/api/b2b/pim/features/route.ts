import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { FeatureModel } from "@/lib/db/models/feature";
import { UOMModel } from "@/lib/db/models/uom";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/pim/features
 * Get all technical features with UOM data populated
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
      // No wholesaler_id - database provides isolation
    };

    if (!includeInactive) {
      query.is_active = true;
    }

    const features = await FeatureModel.find(query)
      .sort({ display_order: 1, label: 1 })
      .lean();

    // Populate UOM data for features that reference a UOM
    const featuresWithUOM = await Promise.all(
      features.map(async (feature: any) => {
        if (feature.uom_id) {
          const uom = await UOMModel.findOne({ uom_id: feature.uom_id }).lean();
          if (uom) {
            feature.uom = {
              uom_id: uom.uom_id,
              symbol: uom.symbol,
              name: uom.name,
              category: uom.category,
            };
          }
        }
        return feature;
      })
    );

    return NextResponse.json({ features: featuresWithUOM });
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
 * Create a new technical feature with UOM support
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { key, label, type, unit, uom_id, options, default_required, display_order } = body;

    if (!key || !label || !type) {
      return NextResponse.json(
        { error: "Key, label, and type are required" },
        { status: 400 }
      );
    }

    // Check if key already exists for this wholesaler
    const existing = await FeatureModel.findOne({
      // No wholesaler_id - database provides isolation
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
      // No wholesaler_id - database provides isolation
      key,
      label,
      type,
      unit, // Keep for backwards compatibility
      uom_id, // Preferred: reference to UOM
      options: options || [],
      default_required: default_required || false,
      display_order: display_order || 0,
      is_active: true,
    });

    // Populate UOM data in response if uom_id is provided
    let featureResponse = feature.toObject();
    if (uom_id) {
      const uom = await UOMModel.findOne({ uom_id }).lean();
      if (uom) {
        featureResponse.uom = {
          uom_id: uom.uom_id,
          symbol: uom.symbol,
          name: uom.name,
          category: uom.category,
        };
      }
    }

    return NextResponse.json({ feature: featureResponse }, { status: 201 });
  } catch (error) {
    console.error("Error creating feature:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
