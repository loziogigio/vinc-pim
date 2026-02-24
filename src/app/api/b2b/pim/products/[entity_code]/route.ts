import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";
import { calculateCompletenessScore, findCriticalIssues } from "@/lib/pim/scorer";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

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
    const { PIMProduct: PIMProductModel, ProductType: ProductTypeModel, TechnicalSpecification: TechnicalSpecificationModel } = await connectWithModels(tenantDb);

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

    // Populate product type technical specifications if product has a product_type
    // Check all possible field names for the product type ID
    let productTypeId = product.product_type?.id || product.product_type?.product_type_id;
    const productTypeSlug = product.product_type?.slug;

    console.log("📦 Product type lookup:", {
      hasProductType: !!product.product_type,
      productTypeId,
      productTypeSlug,
      productTypeKeys: product.product_type ? Object.keys(product.product_type) : [],
      existingTechnicalSpecs: product.product_type?.technical_specifications?.length || 0,
    });

    // Try to find product type by ID first, then by slug as fallback
    let productType: any = null;

    if (productTypeId) {
      productType = await ProductTypeModel.findOne({
        product_type_id: productTypeId,
      }).lean() as any;
    }

    // Fallback: look up by slug if ID lookup failed
    if (!productType && productTypeSlug) {
      console.log("📦 Falling back to slug lookup:", productTypeSlug);
      productType = await ProductTypeModel.findOne({
        slug: productTypeSlug,
      }).lean() as any;

      // If found, update the productTypeId for later use
      if (productType) {
        productTypeId = productType.product_type_id;
      }
    }

    console.log("📦 ProductType found:", {
      found: !!productType,
      productTypeId: productType?.product_type_id,
      hasTechnicalSpecs: productType?.technical_specifications?.length || 0,
    });

    if (productType && productType.technical_specifications && productType.technical_specifications.length > 0) {
      // Get all technical specification IDs
      const specIds = productType.technical_specifications.map((s: any) => s.technical_specification_id);

      // Fetch full technical specification definitions
      const specs = await TechnicalSpecificationModel.find({
        technical_specification_id: { $in: specIds },
        // No wholesaler_id - database provides isolation
      }).lean() as any[];

      // Create a map for quick lookup
      const specMap = new Map(specs.map((s: any) => [s.technical_specification_id, s]));

      // Combine technical specification definitions with product type metadata
      const technicalSpecifications = productType.technical_specifications
        .map((ptSpec: any) => {
          const spec = specMap.get(ptSpec.technical_specification_id);
          if (!spec) return null;

          return {
            technical_specification_id: spec.technical_specification_id,
            key: spec.key,
            label: spec.label,
            type: spec.type,
            unit: spec.unit,
            options: spec.options,
            required: ptSpec.required,
            display_order: ptSpec.display_order,
          };
        })
        .filter((s: any) => s !== null)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

      // Add technical_specifications to the product_type
      product.product_type = {
        ...product.product_type,
        technical_specifications: technicalSpecifications,
      };
    }

    // Auto-assign pkg_id ("1", "2", "3"...) and ensure string type (lean() may return numbers)
    if (product.packaging_options?.length) {
      let maxPkgId = 0;
      for (const pkg of product.packaging_options) {
        const n = parseInt(String(pkg.pkg_id || "0"), 10);
        if (n > maxPkgId) maxPkgId = n;
      }
      let needsPkgIdSave = false;
      for (const pkg of product.packaging_options) {
        if (!pkg.pkg_id) {
          pkg.pkg_id = String(++maxPkgId);
          needsPkgIdSave = true;
        } else if (typeof pkg.pkg_id !== "string") {
          pkg.pkg_id = String(pkg.pkg_id);
          needsPkgIdSave = true;
        }
      }
      if (needsPkgIdSave) {
        await PIMProductModel.updateOne(
          { entity_code, isCurrent: true },
          { $set: { packaging_options: product.packaging_options } }
        );
      }
    }

    // Compute per-packaging promotions from product-level promotions
    if (product.promotions?.length && product.packaging_options?.length) {
      for (const pkg of product.packaging_options) {
        pkg.promotions = product.promotions.filter((promo: any) => {
          if (!promo.target_pkg_ids || promo.target_pkg_ids.length === 0) {
            return pkg.is_sellable !== false;
          }
          return promo.target_pkg_ids.includes(pkg.pkg_id);
        });
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
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "write");
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

    const { PIMProduct: PIMProductModel, Tag: TagModel, Brand: BrandModel } = await connectWithModels(tenantDb);

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;
    const updates = await req.json();

    console.log("📥 PATCH received updates for", entity_code, "- ALL keys:", Object.keys(updates));
    console.log("📥 PATCH share flags:", {
      share_images_with_variants: updates.share_images_with_variants,
      share_media_with_variants: updates.share_media_with_variants,
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
      "marketing_features",        // Marketing highlights (array of strings per language)
      "technical_specifications",  // Technical specs (array of { key, label, value, uom } per language)
      "dimensions",
      "weight",
      "tags",
      "synonym_keys",
      "share_images_with_variants",
      "share_media_with_variants",
      "packaging_options",          // Pricing & packaging (array of { code, qty, uom, pricing, ... })
      "packaging_info",              // Physical packaging info (informational only — not related to selling)
      "promotions",                 // Product-level promotions (array with target_pkg_ids)
      "promo_code",                 // Active promotion codes (for faceting)
      "promo_type",                 // Business categories (for faceting)
      "has_active_promo",           // Has any active promotion (for filtering)
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

    console.log("💿 updateDoc keys being sent to MongoDB:", Object.keys(updateDoc));
    console.log("💿 updateDoc share flags:", {
      share_images_with_variants: updateDoc.share_images_with_variants,
      share_media_with_variants: updateDoc.share_media_with_variants,
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
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

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
