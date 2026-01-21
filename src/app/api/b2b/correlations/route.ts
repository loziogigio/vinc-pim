import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { nanoid } from "nanoid";
import { CORRELATION_TYPES, CorrelationType } from "@/lib/constants/correlation";

/**
 * GET /api/b2b/correlations
 * List correlations with optional filters
 *
 * Query params:
 * - source_entity_code: Filter by source product
 * - target_entity_code: Filter by target product
 * - correlation_type: Filter by type (default: "related")
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 */
export async function GET(req: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "read");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { ProductCorrelation } = await connectWithModels(tenantDb);

    // Parse query params
    const { searchParams } = new URL(req.url);
    const source_entity_code = searchParams.get("source_entity_code");
    const target_entity_code = searchParams.get("target_entity_code");
    const correlation_type = searchParams.get("correlation_type") || "related";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {
      is_active: true,
    };

    if (source_entity_code) {
      query.source_entity_code = source_entity_code;
    }

    if (target_entity_code) {
      query.target_entity_code = target_entity_code;
    }

    if (correlation_type && CORRELATION_TYPES.includes(correlation_type as CorrelationType)) {
      query.correlation_type = correlation_type;
    }

    // Execute query with pagination
    const [correlations, total] = await Promise.all([
      ProductCorrelation.find(query)
        .sort({ position: 1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductCorrelation.countDocuments(query),
    ]);

    return NextResponse.json({
      correlations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching correlations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/correlations
 * Create a new correlation
 *
 * Body:
 * - source_entity_code: Source product code (required)
 * - target_entity_code: Target product code (required)
 * - correlation_type: Type (default: "related")
 * - is_bidirectional: Create reverse correlation too (default: false)
 * - position: Display order (default: 0)
 */
export async function POST(req: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;
    let userId: string | undefined;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "write");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
      userId = `api-key:${apiKeyResult.keyId}`;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
      userId = session.user?.id;
    }

    const { ProductCorrelation, PIMProduct } = await connectWithModels(tenantDb);

    const body = await req.json();
    const {
      source_entity_code,
      target_entity_code,
      correlation_type = "related",
      is_bidirectional = false,
      position = 0,
    } = body;

    // Validate required fields
    if (!source_entity_code || !target_entity_code) {
      return NextResponse.json(
        { error: "source_entity_code and target_entity_code are required" },
        { status: 400 }
      );
    }

    // Prevent self-correlation
    if (source_entity_code === target_entity_code) {
      return NextResponse.json(
        { error: "Cannot create correlation to the same product" },
        { status: 400 }
      );
    }

    // Validate correlation type
    if (!CORRELATION_TYPES.includes(correlation_type as CorrelationType)) {
      return NextResponse.json(
        { error: `Invalid correlation_type. Must be one of: ${CORRELATION_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch both source and target products to enrich correlation data
    const [sourceProduct, targetProduct] = await Promise.all([
      PIMProduct.findOne({
        entity_code: source_entity_code,
        isCurrent: true,
      })
        .select("entity_code sku name images price")
        .lean() as Promise<any>,
      PIMProduct.findOne({
        entity_code: target_entity_code,
        isCurrent: true,
      })
        .select("entity_code sku name images price")
        .lean() as Promise<any>,
    ]);

    if (!sourceProduct) {
      return NextResponse.json(
        { error: `Source product not found: ${source_entity_code}` },
        { status: 404 }
      );
    }

    if (!targetProduct) {
      return NextResponse.json(
        { error: `Target product not found: ${target_entity_code}` },
        { status: 404 }
      );
    }

    // Check for duplicate
    const existingCorrelation = await ProductCorrelation.findOne({
      source_entity_code,
      target_entity_code,
      correlation_type,
    });

    if (existingCorrelation) {
      return NextResponse.json(
        { error: "Correlation already exists" },
        { status: 409 }
      );
    }

    // Get cover images for both products
    const sourceCoverImage = Array.isArray(sourceProduct.images)
      ? sourceProduct.images.find((img: any) => img.is_cover) || sourceProduct.images[0]
      : null;
    const targetCoverImage = Array.isArray(targetProduct.images)
      ? targetProduct.images.find((img: any) => img.is_cover) || targetProduct.images[0]
      : null;

    // Create the correlation with both source and target product data
    const correlationData = {
      correlation_id: nanoid(),
      source_entity_code,
      target_entity_code,
      correlation_type,
      source_product: {
        entity_code: sourceProduct.entity_code,
        sku: sourceProduct.sku,
        name: sourceProduct.name || {},
        cover_image_url: sourceCoverImage?.url,
        price: sourceProduct.price,
      },
      target_product: {
        entity_code: targetProduct.entity_code,
        sku: targetProduct.sku,
        name: targetProduct.name || {},
        cover_image_url: targetCoverImage?.url,
        price: targetProduct.price,
      },
      position,
      is_bidirectional,
      is_active: true,
      created_by: userId,
    };

    const correlation = await ProductCorrelation.create(correlationData);
    const createdCorrelations = [correlation.toObject()];

    // Create reverse correlation if bidirectional
    if (is_bidirectional) {
      // Check if reverse correlation already exists
      const reverseExists = await ProductCorrelation.findOne({
        source_entity_code: target_entity_code,
        target_entity_code: source_entity_code,
        correlation_type,
      });

      if (!reverseExists) {
        // For reverse: source becomes target and vice versa
        const reverseCorrelation = await ProductCorrelation.create({
          correlation_id: nanoid(),
          source_entity_code: target_entity_code,
          target_entity_code: source_entity_code,
          correlation_type,
          source_product: {
            entity_code: targetProduct.entity_code,
            sku: targetProduct.sku,
            name: targetProduct.name || {},
            cover_image_url: targetCoverImage?.url,
            price: targetProduct.price,
          },
          target_product: {
            entity_code: sourceProduct.entity_code,
            sku: sourceProduct.sku,
            name: sourceProduct.name || {},
            cover_image_url: sourceCoverImage?.url,
            price: sourceProduct.price,
          },
          position,
          is_bidirectional: true,
          is_active: true,
          created_by: userId,
        });
        createdCorrelations.push(reverseCorrelation.toObject());
      }
    }

    return NextResponse.json({
      success: true,
      correlations: createdCorrelations,
      message: `Created ${createdCorrelations.length} correlation(s)`,
    });
  } catch (error) {
    console.error("Error creating correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
