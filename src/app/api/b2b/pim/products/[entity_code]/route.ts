import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { ProductTypeModel } from "@/lib/db/models/product-type";
import { FeatureModel } from "@/lib/db/models/feature";
import { TagModel } from "@/lib/db/models/tag";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";
import { calculateCompletenessScore, findCriticalIssues } from "@/lib/pim/scorer";

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

    let product: any;
    let currentVersion: any;

    if (versionParam) {
      // Fetch specific version
      const version = parseInt(versionParam);
      product = await PIMProductModel.findOne({
        entity_code,
        // No wholesaler_id - database provides isolation
        version,
      }).lean() as any;

      // Also fetch current version info for comparison
      currentVersion = await PIMProductModel.findOne({
        entity_code,
        // No wholesaler_id - database provides isolation
        isCurrent: true,
      })
        .select("version")
        .lean() as any;
    } else {
      // Fetch current version
      product = await PIMProductModel.findOne({
        entity_code,
        // No wholesaler_id - database provides isolation
        isCurrent: true,
      }).lean() as any;
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Recalculate completeness score on fetch to ensure accuracy
    const currentScore = calculateCompletenessScore(product);
    const currentIssues = findCriticalIssues(product);

    // Update stored score if it differs (only for current version)
    if (!versionParam && (product.completeness_score !== currentScore ||
        JSON.stringify(product.critical_issues) !== JSON.stringify(currentIssues))) {
      await PIMProductModel.updateOne(
        { entity_code, isCurrent: true },
        {
          $set: {
            completeness_score: currentScore,
            critical_issues: currentIssues
          }
        }
      );
      // Update local product object
      product.completeness_score = currentScore;
      product.critical_issues = currentIssues;
    } else {
      // For old versions, just update local object (don't save to DB)
      product.completeness_score = currentScore;
      product.critical_issues = currentIssues;
    }

    // Populate product type feature details if product has a product_type
    if (product.product_type?.id) {
      const productType = await ProductTypeModel.findOne({
        product_type_id: product.product_type.id,
        // No wholesaler_id - database provides isolation
      }).lean() as any;

      if (productType && productType.features && productType.features.length > 0) {
        // Get all feature IDs
        const featureIds = productType.features.map((f: any) => f.feature_id);

        // Fetch full feature definitions
        const features = await FeatureModel.find({
          feature_id: { $in: featureIds },
          // No wholesaler_id - database provides isolation
        }).lean() as any[];

        // Create a map for quick lookup
        const featureMap = new Map(features.map((f: any) => [f.feature_id, f]));

        // Combine feature definitions with product type metadata
        const featureDetails = productType.features
          .map((ptFeature: any) => {
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
          .filter((f: any) => f !== null)
          .sort((a: any, b: any) => {
            const aOrder = productType.features.find((f: any) => f.feature_id === a.feature_id)?.display_order || 0;
            const bOrder = productType.features.find((f: any) => f.feature_id === b.feature_id)?.display_order || 0;
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
      synonym_keys: updates.synonym_keys,
    });

    // Build update document
    const updateDoc: any = {
      updated_at: new Date(),
    };

    // Allow updating specific fields
    const allowedFields = [
      "name",
      "product_model",
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
      "synonym_keys",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateDoc[field] = updates[field];
      }
    });

    let sanitizedTagRefs: any[] | null = null;
    if (updates.tag !== undefined) {
      sanitizedTagRefs = Array.isArray(updates.tag)
        ? updates.tag
            .filter((tag: any) => tag && tag.name)
            .map((tag: any) => {
              // Extract string from multilingual name if needed
              const tagName = typeof tag.name === 'string'
                ? tag.name
                : (tag.name?.it || tag.name?.en || Object.values(tag.name || {})[0] || '');
              const tagSlug = tag.slug ||
                tagName.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

              return {
                tag_id: tag.id || tag.tag_id || tagSlug,
                name: tag.name, // Keep multilingual name
                slug: tagSlug,
                color: tag.color,
                is_active: tag.is_active ?? true,
              };
            })
        : [];

      // Store as 'tags' field (matches schema) instead of 'tag'
      updateDoc.tags = sanitizedTagRefs;
    }

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
      synonym_keys: updateDoc.synonym_keys,
    });

    // Get the old product to check if brand changed
    const oldProduct = await PIMProductModel.findOne({
      entity_code,
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    }).lean() as any;

    if (!oldProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const oldBrandId = oldProduct.brand?.id;
    const newBrandId = updates.brand?.id;
    const oldTagIds = Array.isArray(oldProduct.tags)
      ? oldProduct.tags.map((tag: any) => tag.tag_id).filter(Boolean)
      : [];

    let product = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        // No wholesaler_id - database provides isolation
        isCurrent: true,
      },
      { $set: updateDoc },
      { new: true }
    ).lean() as any;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Recalculate completeness score after update
    const newScore = calculateCompletenessScore(product);
    const newIssues = findCriticalIssues(product);

    // Update with recalculated score if changed
    if (product.completeness_score !== newScore ||
        JSON.stringify(product.critical_issues) !== JSON.stringify(newIssues)) {
      product = await PIMProductModel.findOneAndUpdate(
        {
          entity_code,
          isCurrent: true,
        },
        {
          $set: {
            completeness_score: newScore,
            critical_issues: newIssues
          }
        },
        { new: true }
      ).lean() as any;

      console.log(`📊 Recalculated score for ${entity_code}: ${newScore} (was ${product.completeness_score || 0})`);
    }

    // Update brand product counts if brand changed
    if (oldBrandId !== newBrandId) {
      const { BrandModel } = await import("@/lib/db/models/brand");

      // Update old brand count (decrease)
      if (oldBrandId) {
        const oldBrandCount = await PIMProductModel.countDocuments({
          // No wholesaler_id - database provides isolation
          isCurrent: true,
          "brand.brand_id": oldBrandId,
        });
        // No wholesaler_id - database provides isolation
        await BrandModel.updateOne(
          { brand_id: oldBrandId },
          { $set: { product_count: oldBrandCount } }
        );
      }

      // Update new brand count (increase)
      if (newBrandId) {
        const newBrandCount = await PIMProductModel.countDocuments({
          // No wholesaler_id - database provides isolation
          isCurrent: true,
          "brand.brand_id": newBrandId,
        });
        // No wholesaler_id - database provides isolation
        await BrandModel.updateOne(
          { brand_id: newBrandId },
          { $set: { product_count: newBrandCount } }
        );
      }
    }

    if (sanitizedTagRefs) {
      const newTagIds = sanitizedTagRefs.map((tag) => tag.tag_id).filter(Boolean);
      const affectedTagIds = Array.from(new Set([...oldTagIds, ...newTagIds]));

      await Promise.all(
        affectedTagIds.map(async (tagId) => {
          const tagCount = await PIMProductModel.countDocuments({
            // No wholesaler_id - database provides isolation
            isCurrent: true,
            "tags.tag_id": tagId,
          });

          // No wholesaler_id - database provides isolation
          await TagModel.updateOne(
            { tag_id: tagId },
            { $set: { product_count: tagCount } }
          );
        })
      );
    }

    console.log("✅ Product updated and returned:", {
      product_type: product.product_type,
      collections: product.collections,
      attributes: product.attributes,
      tags: product.tags,
      synonym_keys: product.synonym_keys,
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

/**
 * DELETE /api/b2b/pim/products/[entity_code]
 * Delete a product (all versions) and remove from Solr
 */
export async function DELETE(
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

    // Remove from Solr first (if enabled)
    let solrDeleted = false;
    const adapterConfigs = loadAdapterConfigs();
    if (adapterConfigs.solr?.enabled) {
      try {
        const solrAdapter = new SolrAdapter(adapterConfigs.solr);
        const result = await solrAdapter.deleteProduct(entity_code);
        solrDeleted = result.success;
        console.log(`🔍 Solr delete result for ${entity_code}:`, result);
      } catch (solrError: any) {
        console.error(`⚠️ Failed to delete from Solr: ${solrError.message}`);
        // Continue with delete even if Solr delete fails
      }
    }

    // Delete all versions of the product from MongoDB
    const result = await PIMProductModel.deleteMany({ entity_code });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.log(`🗑️ Deleted product ${entity_code} (${result.deletedCount} version(s))${solrDeleted ? " (removed from Solr)" : ""}`);

    return NextResponse.json({
      success: true,
      message: `Product ${entity_code} deleted successfully`,
      deletedCount: result.deletedCount,
      solr_deleted: solrDeleted,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
