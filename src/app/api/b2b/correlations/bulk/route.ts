import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { nanoid } from "nanoid";
import { CORRELATION_TYPES, CorrelationType } from "@/lib/constants/correlation";

interface CorrelationInput {
  source_entity_code: string;
  target_entity_code: string;
  correlation_type?: string;
  is_bidirectional?: boolean;
  position?: number;
}

interface BulkImportResult {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{
    index: number;
    source: string;
    target: string;
    error: string;
  }>;
}

/**
 * POST /api/b2b/correlations/bulk
 * Bulk import correlations via JSON API
 *
 * Body:
 * - correlations: Array of correlation objects
 * - sync_mode: "merge" (default) or "replace"
 * - correlation_type: Default type for all (default: "related")
 *
 * Example:
 * {
 *   "correlations": [
 *     { "source_entity_code": "001479", "target_entity_code": "001480", "is_bidirectional": true },
 *     { "source_entity_code": "001479", "target_entity_code": "001481" }
 *   ],
 *   "sync_mode": "merge"
 * }
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
      correlations,
      sync_mode = "merge",
      correlation_type: defaultType = "related",
    } = body;

    // Validate input
    if (!Array.isArray(correlations) || correlations.length === 0) {
      return NextResponse.json(
        { error: "correlations array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (correlations.length > 1000) {
      return NextResponse.json(
        { error: "Maximum 1000 correlations per request" },
        { status: 400 }
      );
    }

    if (!["merge", "replace"].includes(sync_mode)) {
      return NextResponse.json(
        { error: "sync_mode must be 'merge' or 'replace'" },
        { status: 400 }
      );
    }

    if (!CORRELATION_TYPES.includes(defaultType as CorrelationType)) {
      return NextResponse.json(
        { error: `Invalid correlation_type. Must be one of: ${CORRELATION_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // If replace mode, delete existing correlations of this type
    if (sync_mode === "replace") {
      await ProductCorrelation.deleteMany({
        correlation_type: defaultType,
      });
    }

    // Collect all unique entity codes to fetch products in batch
    const entityCodes = new Set<string>();
    for (const corr of correlations as CorrelationInput[]) {
      if (corr.source_entity_code) entityCodes.add(corr.source_entity_code);
      if (corr.target_entity_code) entityCodes.add(corr.target_entity_code);
    }

    // Fetch all products in one query
    const products = await PIMProduct.find({
      entity_code: { $in: Array.from(entityCodes) },
      isCurrent: true,
    })
      .select("entity_code sku name images price")
      .lean();

    // Build product lookup map
    const productMap = new Map<string, any>();
    for (const product of products) {
      productMap.set(product.entity_code, product);
    }

    // Process correlations
    const result: BulkImportResult = {
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const correlationsToCreate: any[] = [];

    for (let i = 0; i < correlations.length; i++) {
      const corr = correlations[i] as CorrelationInput;
      const {
        source_entity_code,
        target_entity_code,
        correlation_type = defaultType,
        is_bidirectional = false,
        position = i,
      } = corr;

      // Validate required fields
      if (!source_entity_code || !target_entity_code) {
        result.failed++;
        result.errors.push({
          index: i,
          source: source_entity_code || "",
          target: target_entity_code || "",
          error: "source_entity_code and target_entity_code are required",
        });
        continue;
      }

      // Skip self-correlations
      if (source_entity_code === target_entity_code) {
        result.skipped++;
        continue;
      }

      // Check products exist
      const sourceProduct = productMap.get(source_entity_code);
      const targetProduct = productMap.get(target_entity_code);

      if (!sourceProduct) {
        result.failed++;
        result.errors.push({
          index: i,
          source: source_entity_code,
          target: target_entity_code,
          error: `Source product not found: ${source_entity_code}`,
        });
        continue;
      }

      if (!targetProduct) {
        result.failed++;
        result.errors.push({
          index: i,
          source: source_entity_code,
          target: target_entity_code,
          error: `Target product not found: ${target_entity_code}`,
        });
        continue;
      }

      // Get cover images
      const sourceCoverImage = Array.isArray(sourceProduct.images)
        ? sourceProduct.images.find((img: any) => img.is_cover) || sourceProduct.images[0]
        : null;
      const targetCoverImage = Array.isArray(targetProduct.images)
        ? targetProduct.images.find((img: any) => img.is_cover) || targetProduct.images[0]
        : null;

      // Build correlation document
      correlationsToCreate.push({
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
      });

      // Add reverse correlation if bidirectional
      if (is_bidirectional) {
        correlationsToCreate.push({
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
      }
    }

    // Bulk insert with ordered: false to continue on duplicates
    if (correlationsToCreate.length > 0) {
      try {
        const insertResult = await ProductCorrelation.insertMany(correlationsToCreate, {
          ordered: false, // Continue inserting even if some fail (duplicates)
        });
        result.created = insertResult.length;
      } catch (error: any) {
        // Handle bulk write errors (e.g., duplicate key errors)
        if (error.name === "MongoBulkWriteError" || error.code === 11000) {
          // Some inserts succeeded, some failed due to duplicates
          result.created = error.insertedCount || 0;
          result.skipped += correlationsToCreate.length - result.created;

          // Extract duplicate errors if needed
          if (error.writeErrors) {
            for (const writeError of error.writeErrors) {
              if (writeError.code === 11000) {
                result.skipped++;
              } else {
                result.failed++;
                result.errors.push({
                  index: writeError.index,
                  source: correlationsToCreate[writeError.index]?.source_entity_code || "",
                  target: correlationsToCreate[writeError.index]?.target_entity_code || "",
                  error: writeError.errmsg || "Insert failed",
                });
              }
            }
          }
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({
      success: true,
      result,
      message: `Created ${result.created} correlations, skipped ${result.skipped}, failed ${result.failed}`,
    });
  } catch (error) {
    console.error("Error in bulk correlation import:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
