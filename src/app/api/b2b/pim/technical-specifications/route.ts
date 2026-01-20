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
    const apiKeyResult = await verifyAPIKeyFromRequest(req, "technical-specifications");
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
 * GET /api/b2b/pim/technical-specifications
 * Get all technical specifications with UOM data populated
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

    const { TechnicalSpecification, UOM } = auth.models;

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query
    const query: any = {
      // No wholesaler_id - database provides isolation
    };

    if (!includeInactive) {
      query.is_active = true;
    }

    const technicalSpecifications = await TechnicalSpecification.find(query)
      .sort({ display_order: 1, label: 1 })
      .lean();

    // Populate UOM data for technical specifications that reference a UOM
    const technicalSpecificationsWithUOM = await Promise.all(
      technicalSpecifications.map(async (spec: any) => {
        if (spec.uom_id) {
          const uom = await UOM.findOne({ uom_id: spec.uom_id }).lean();
          if (uom) {
            spec.uom = {
              uom_id: uom.uom_id,
              symbol: uom.symbol,
              name: uom.name,
              category: uom.category,
            };
          }
        }
        return spec;
      })
    );

    return NextResponse.json({ technical_specifications: technicalSpecificationsWithUOM });
  } catch (error) {
    console.error("Error fetching technical specifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/technical-specifications
 * Create a new technical specification with UOM support
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

    const { TechnicalSpecification, UOM } = auth.models;

    const body = await req.json();
    const { key, label, type, unit, uom_id, options, default_required, display_order } = body;

    if (!key || !label || !type) {
      return NextResponse.json(
        { error: "Key, label, and type are required" },
        { status: 400 }
      );
    }

    // Validate key format: only lowercase letters, numbers, underscores, hyphens
    const keyRegex = /^[a-z0-9_-]+$/;
    if (!keyRegex.test(key)) {
      return NextResponse.json(
        { error: "Key must contain only lowercase letters, numbers, underscores, and hyphens (no spaces or special characters)" },
        { status: 400 }
      );
    }

    // Check if key already exists
    const existing = await TechnicalSpecification.findOne({
      // No wholesaler_id - database provides isolation
      key,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A technical specification with this key already exists" },
        { status: 400 }
      );
    }

    const technicalSpecification = await TechnicalSpecification.create({
      technical_specification_id: nanoid(12),
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
    let specResponse = technicalSpecification.toObject();
    if (uom_id) {
      const uom = await UOM.findOne({ uom_id }).lean();
      if (uom) {
        specResponse.uom = {
          uom_id: uom.uom_id,
          symbol: uom.symbol,
          name: uom.name,
          category: uom.category,
        };
      }
    }

    return NextResponse.json({ technical_specification: specResponse }, { status: 201 });
  } catch (error) {
    console.error("Error creating technical specification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/technical-specifications
 * Bulk delete technical specifications
 *
 * Body options:
 * - { delete_all: true } - Delete all technical specifications (skips those used by product types)
 * - { technical_specification_ids: ["id1", "id2"] } - Delete specific technical specifications by IDs
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

    const { TechnicalSpecification, ProductType } = auth.models;

    const body = await req.json().catch(() => ({}));
    const { delete_all, technical_specification_ids } = body;

    if (!delete_all && (!technical_specification_ids || !Array.isArray(technical_specification_ids))) {
      return NextResponse.json(
        { error: "Either delete_all: true or technical_specification_ids array is required" },
        { status: 400 }
      );
    }

    // Get technical specifications in use by product types
    const productTypes = await ProductType.find({}).lean();
    const specsInUse = new Set<string>();
    for (const pt of productTypes) {
      if (pt.technical_specifications && Array.isArray(pt.technical_specifications)) {
        for (const spec of pt.technical_specifications) {
          if (spec.technical_specification_id) {
            specsInUse.add(spec.technical_specification_id);
          }
        }
      }
    }

    let specsToDelete: string[];

    if (delete_all) {
      // Get all technical specification IDs
      const allSpecs = await TechnicalSpecification.find({}).select("technical_specification_id").lean();
      specsToDelete = allSpecs
        .map((spec: { technical_specification_id: string }) => spec.technical_specification_id)
        .filter((id: string) => !specsInUse.has(id));
    } else {
      // Filter out technical specifications in use
      specsToDelete = technical_specification_ids.filter((id: string) => !specsInUse.has(id));
    }

    // Delete technical specifications
    const result = await TechnicalSpecification.deleteMany({
      technical_specification_id: { $in: specsToDelete },
    });

    const skipped = delete_all
      ? specsInUse.size
      : technical_specification_ids.filter((id: string) => specsInUse.has(id)).length;

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      skipped,
      skipped_reason: skipped > 0 ? "Technical specifications in use by product types" : undefined,
    });
  } catch (error) {
    console.error("Error bulk deleting technical specifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
