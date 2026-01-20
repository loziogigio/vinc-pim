import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";

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
 * PATCH /api/b2b/pim/technical-specifications/[technicalSpecificationId]
 * Update a technical specification
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ technicalSpecificationId: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { TechnicalSpecification } = auth.models;

    const { technicalSpecificationId } = await params;
    const body = await req.json();
    const { key, label, type, unit, options, default_required, display_order, is_active } = body;

    // Check if technical specification exists
    const technicalSpecification = await TechnicalSpecification.findOne({
      technical_specification_id: technicalSpecificationId,
    });

    if (!technicalSpecification) {
      return NextResponse.json(
        { error: "Technical specification not found" },
        { status: 404 }
      );
    }

    // Validate key format if provided
    if (key) {
      const keyRegex = /^[a-z0-9_-]+$/;
      if (!keyRegex.test(key)) {
        return NextResponse.json(
          { error: "Key must contain only lowercase letters, numbers, underscores, and hyphens (no spaces or special characters)" },
          { status: 400 }
        );
      }
    }

    // If key is changing, check for duplicates
    if (key && key !== technicalSpecification.key) {
      const existing = await TechnicalSpecification.findOne({
        key,
        technical_specification_id: { $ne: technicalSpecificationId },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A technical specification with this key already exists" },
          { status: 400 }
        );
      }
    }

    // Update technical specification
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (key !== undefined) updateData.key = key;
    if (label !== undefined) updateData.label = label;
    if (type !== undefined) updateData.type = type;
    if (unit !== undefined) updateData.unit = unit;
    if (options !== undefined) updateData.options = options;
    if (default_required !== undefined) updateData.default_required = default_required;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedTechnicalSpecification = await TechnicalSpecification.findOneAndUpdate(
      { technical_specification_id: technicalSpecificationId },
      updateData,
      { new: true }
    );

    return NextResponse.json({ technical_specification: updatedTechnicalSpecification });
  } catch (error) {
    console.error("Error updating technical specification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/technical-specifications/[technicalSpecificationId]
 * Delete a technical specification
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ technicalSpecificationId: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { TechnicalSpecification, ProductType } = auth.models;

    const { technicalSpecificationId } = await params;

    // Check if technical specification exists
    const technicalSpecification = await TechnicalSpecification.findOne({
      technical_specification_id: technicalSpecificationId,
    });

    if (!technicalSpecification) {
      return NextResponse.json(
        { error: "Technical specification not found" },
        { status: 404 }
      );
    }

    // Check if technical specification is being used by any product types
    const productTypesUsingSpec = await ProductType.countDocuments({
      "technical_specifications.technical_specification_id": technicalSpecificationId,
    });

    if (productTypesUsingSpec > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete technical specification used in ${productTypesUsingSpec} product type(s). Please remove it from product types first.`,
        },
        { status: 400 }
      );
    }

    // Delete technical specification
    await TechnicalSpecification.deleteOne({
      technical_specification_id: technicalSpecificationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting technical specification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
