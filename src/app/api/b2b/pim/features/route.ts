import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

/**
 * Authenticate request via session or API key
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
  error?: string;
  statusCode?: number;
}> {
  const authMethod = req.headers.get("x-auth-method");
  let tenantId: string;
  let tenantDb: string;

  if (authMethod === "api-key") {
    const apiKeyResult = await verifyAPIKeyFromRequest(req, "features");
    if (!apiKeyResult.authenticated) {
      return {
        authenticated: false,
        error: apiKeyResult.error,
        statusCode: apiKeyResult.statusCode,
      };
    }
    tenantId = apiKeyResult.tenantId!;
    tenantDb = apiKeyResult.tenantDb!;
  } else {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return { authenticated: false, error: "Unauthorized", statusCode: 401 };
    }
    tenantId = session.tenantId;
    tenantDb = `vinc-${session.tenantId}`;
  }

  // Get tenant-specific models from connection pool
  const models = await connectWithModels(tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    models,
  };
}

/**
 * GET /api/b2b/pim/features
 * Get all technical features with UOM data populated
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { Feature, UOM } = auth.models;

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query
    const query: any = {
      // No wholesaler_id - database provides isolation
    };

    if (!includeInactive) {
      query.is_active = true;
    }

    const features = await Feature.find(query)
      .sort({ display_order: 1, label: 1 })
      .lean();

    // Populate UOM data for features that reference a UOM
    const featuresWithUOM = await Promise.all(
      features.map(async (feature: any) => {
        if (feature.uom_id) {
          const uom = await UOM.findOne({ uom_id: feature.uom_id }).lean();
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
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { Feature, UOM } = auth.models;

    const body = await req.json();
    const { key, label, type, unit, uom_id, options, default_required, display_order } = body;

    if (!key || !label || !type) {
      return NextResponse.json(
        { error: "Key, label, and type are required" },
        { status: 400 }
      );
    }

    // Check if key already exists for this wholesaler
    const existing = await Feature.findOne({
      // No wholesaler_id - database provides isolation
      key,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A feature with this key already exists" },
        { status: 400 }
      );
    }

    const feature = await Feature.create({
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
      const uom = await UOM.findOne({ uom_id }).lean();
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

/**
 * DELETE /api/b2b/pim/features
 * Bulk delete features
 *
 * Body options:
 * - { delete_all: true } - Delete all features (skips those used by product types)
 * - { feature_ids: ["id1", "id2"] } - Delete specific features by IDs
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { Feature, ProductType } = auth.models;

    const body = await req.json().catch(() => ({}));
    const { delete_all, feature_ids } = body;

    if (!delete_all && (!feature_ids || !Array.isArray(feature_ids))) {
      return NextResponse.json(
        { error: "Either delete_all: true or feature_ids array is required" },
        { status: 400 }
      );
    }

    // Get features in use by product types
    const productTypes = await ProductType.find({}).lean();
    const featuresInUse = new Set<string>();
    for (const pt of productTypes) {
      if (pt.features && Array.isArray(pt.features)) {
        for (const f of pt.features) {
          if (f.feature_id) {
            featuresInUse.add(f.feature_id);
          }
        }
      }
    }

    let featuresToDelete: string[];

    if (delete_all) {
      // Get all feature IDs
      const allFeatures = await Feature.find({}).select("feature_id").lean();
      featuresToDelete = allFeatures
        .map((f: { feature_id: string }) => f.feature_id)
        .filter((id: string) => !featuresInUse.has(id));
    } else {
      // Filter out features in use
      featuresToDelete = feature_ids.filter((id: string) => !featuresInUse.has(id));
    }

    // Delete features
    const result = await Feature.deleteMany({
      feature_id: { $in: featuresToDelete },
    });

    const skipped = delete_all
      ? featuresInUse.size
      : feature_ids.filter((id: string) => featuresInUse.has(id)).length;

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      skipped,
      skipped_reason: skipped > 0 ? "Features in use by product types" : undefined,
    });
  } catch (error) {
    console.error("Error bulk deleting features:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
