import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { ProductTypeModel } from "@/lib/db/models/product-type";
import { FeatureModel } from "@/lib/db/models/feature";

/**
 * GET /api/b2b/pim/products/[entity_code]?version=X
 * Get a single product by entity_code
 * - If version parameter is provided, fetch that specific version
 * - Otherwise, fetch the current version
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    // Check if specific version is requested
    const searchParams = req.nextUrl.searchParams;
    const versionParam = searchParams.get("version");

    let product;
    let currentVersion;

    if (versionParam) {
      // Fetch specific version
      const version = parseInt(versionParam);
      product = await PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        version,
      }).lean();

      // Also fetch current version info for comparison
      currentVersion = await PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      })
        .select("version")
        .lean();
    } else {
      // Fetch current version
      product = await PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      }).lean();
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Populate product type feature details if product has a product_type
    if (product.product_type?.id) {
      const productType = await ProductTypeModel.findOne({
        product_type_id: product.product_type.id,
        wholesaler_id: session.userId,
      }).lean();

      if (productType && productType.features && productType.features.length > 0) {
        // Get all feature IDs
        const featureIds = productType.features.map((f) => f.feature_id);

        // Fetch full feature definitions
        const features = await FeatureModel.find({
          feature_id: { $in: featureIds },
          wholesaler_id: session.userId,
        }).lean();

        // Create a map for quick lookup
        const featureMap = new Map(features.map((f) => [f.feature_id, f]));

        // Combine feature definitions with product type metadata
        const featureDetails = productType.features
          .map((ptFeature) => {
            const feature = featureMap.get(ptFeature.feature_id);
            if (!feature) return null;

            return {
              feature_id: feature.feature_id,
              key: feature.key,
              label: feature.label,
              type: feature.type,
              unit: feature.unit,
              options: feature.options,
              required: ptFeature.required,
            };
          })
          .filter((f) => f !== null)
          .sort((a, b) => {
            const aOrder = productType.features.find((f) => f.feature_id === a.feature_id)?.display_order || 0;
            const bOrder = productType.features.find((f) => f.feature_id === b.feature_id)?.display_order || 0;
            return aOrder - bOrder;
          });

        // Add featureDetails to the product_type
        product.product_type = {
          ...product.product_type,
          featureDetails,
        };
      }
    }

    const response: any = { product };

    // Include current version info if viewing old version
    if (versionParam && currentVersion) {
      response.currentVersion = currentVersion.version;
      response.isOldVersion = product.version !== currentVersion.version;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/pim/products/[entity_code]
 * Update a product
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;
    const updates = await req.json();

    console.log("📥 PATCH received updates for", entity_code, ":", {
      product_type: updates.product_type,
      collections: updates.collections,
      attributes: updates.attributes,
      tags: updates.tags,
    });

    // Build update document
    const updateDoc: any = {
      updated_at: new Date(),
    };

    // Allow updating specific fields
    const allowedFields = [
      "name",
      "description",
      "short_description",
      "price",
      "currency",
      "stock_quantity",
      "status",
      "brand",
      "product_type",
      "collections",
      "category",
      "attributes",
      "dimensions",
      "weight",
      "tags",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateDoc[field] = updates[field];
      }
    });

    // Handle stock_quantity -> quantity field mapping
    if (updates.stock_quantity !== undefined) {
      updateDoc.quantity = updates.stock_quantity;
      delete updateDoc.stock_quantity;
    }

    console.log("💿 updateDoc being sent to MongoDB:", {
      product_type: updateDoc.product_type,
      collections: updateDoc.collections,
      attributes: updateDoc.attributes,
      tags: updateDoc.tags,
    });

    const product = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      },
      { $set: updateDoc },
      { new: true }
    ).lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.log("✅ Product updated and returned:", {
      product_type: product.product_type,
      collections: product.collections,
      attributes: product.attributes,
      tags: product.tags,
    });

    return NextResponse.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
