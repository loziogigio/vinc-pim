import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { safeRegexQuery, safeRegexQueryWithMatchMode, sanitizeMongoQuery, type MatchMode } from "@/lib/security";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import crypto from "crypto";

/**
 * GET /api/b2b/pim/products
 * List products with filtering and pagination
 * Supports both session auth and API key auth
 */
export async function GET(req: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      // Verify API key and secret
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "pim");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      // Require valid session authentication (no env var fallback)
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    // Get tenant-specific models from connection pool
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sourceId = searchParams.get("source_id");
    const batchId = searchParams.get("batch_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const sortBy = searchParams.get("sort") || "priority"; // priority | score | updated | name

    // Default language for multilingual fields (name, description)
    const defaultLang = "it";

    // Advanced filters
    const entityCode = searchParams.get("entity_code");
    const sku = searchParams.get("sku");
    const skuMatch = (searchParams.get("sku_match") || "exact") as MatchMode;
    const parentSku = searchParams.get("parent_sku");
    const parentSkuMatch = (searchParams.get("parent_sku_match") || "exact") as MatchMode;
    const brand = searchParams.get("brand");
    const category = searchParams.get("category");
    const priceMin = searchParams.get("price_min");
    const priceMax = searchParams.get("price_max");
    const scoreMin = searchParams.get("score_min");
    const scoreMax = searchParams.get("score_max");

    // Build query
    const query: any = {
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    };

    if (status) query.status = sanitizeMongoQuery(status);
    if (sourceId) query["source.source_id"] = sanitizeMongoQuery(sourceId);
    if (batchId) {
      // Support partial matching for batch ID (sanitized)
      query["source.batch_id"] = safeRegexQuery(batchId);
    }

    // Search by title (multilingual field - search in default language)
    // Supports both string name and multilingual object name.it
    if (search) {
      const searchRegex = safeRegexQuery(search);
      query.$or = [
        { [`name.${defaultLang}`]: searchRegex }, // Multilingual: name.it
        { name: searchRegex }, // Simple string name (fallback)
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.updated_at = {};
      if (dateFrom) {
        query.updated_at.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Include the entire end date
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.updated_at.$lte = endDate;
      }
    }

    // Advanced filters (all sanitized to prevent NoSQL injection)
    if (entityCode) {
      query.entity_code = safeRegexQuery(entityCode);
    }
    if (sku) {
      // Use match mode for SKU (handles special chars like *, /, ,, +, &, $)
      query.sku = safeRegexQueryWithMatchMode(sku, skuMatch);
    }
    if (parentSku) {
      // Use match mode for parent_sku (handles special chars like *, /, ,, +, &, $)
      query.parent_sku = safeRegexQueryWithMatchMode(parentSku, parentSkuMatch);
    }
    if (brand) {
      query["brand.name"] = safeRegexQuery(brand);
    }
    if (category) {
      query["category.name"] = safeRegexQuery(category);
    }

    // Price range filter
    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) {
        query.price.$gte = parseFloat(priceMin);
      }
      if (priceMax) {
        query.price.$lte = parseFloat(priceMax);
      }
    }

    // Completeness score range filter
    if (scoreMin || scoreMax) {
      query.completeness_score = {};
      if (scoreMin) {
        query.completeness_score.$gte = parseInt(scoreMin);
      }
      if (scoreMax) {
        query.completeness_score.$lte = parseInt(scoreMax);
      }
    }

    // Build sort
    let sort: any = {};
    if (sortBy === "priority") {
      sort = { "analytics.priority_score": -1 };
    } else if (sortBy === "score") {
      sort = { completeness_score: 1 }; // Lowest first (needs most work)
    } else if (sortBy === "name") {
      // Sort by title (multilingual field - use default language)
      sort = { [`name.${defaultLang}`]: 1 };
    } else if (sortBy === "updated") {
      sort = { updated_at: -1 };
    } else {
      sort = { updated_at: -1 };
    }

    // Execute query with pagination
    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PIMProductModel.countDocuments(query),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/products
 * Create a new product manually
 * Supports both session auth and API key auth
 */
export async function POST(req: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      // Verify API key and secret
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "pim");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      // Require valid session authentication (no env var fallback)
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    // Get tenant-specific models from connection pool
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { entity_code, sku, name, description, price, currency, category, brand, stock_status, quantity } = body;

    // Validate required fields
    if (!entity_code || !sku || !name) {
      return NextResponse.json(
        { error: "Missing required fields: entity_code, sku, name" },
        { status: 400 }
      );
    }

    // Check if product with same entity_code or sku already exists
    const existingProduct = await PIMProductModel.findOne({
      $or: [{ entity_code }, { sku }],
      isCurrent: true,
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: `Product with entity_code "${entity_code}" or SKU "${sku}" already exists` },
        { status: 409 }
      );
    }

    // Generate unique hash for version tracking
    const versionHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ entity_code, sku, name, created_at: new Date() }))
      .digest("hex")
      .substring(0, 16);

    // Create new product with placeholder image (will be updated later)
    const newProduct = await PIMProductModel.create({
      entity_code,
      sku,
      name,
      description: description || "",
      long_description: "",
      price: price || 0,
      currency: currency || "EUR",
      category: category ? { id: category, name: category } : undefined,
      brand: brand ? { id: brand, name: brand } : undefined,
      stock_status: stock_status || "in_stock",
      quantity: quantity || 0,
      status: "draft", // New manual products start as draft
      isCurrent: true,
      version: 1,
      version_hash: versionHash,
      // Placeholder image - user will upload actual image later
      image: {
        id: "placeholder",
        thumbnail: "/placeholder-product.png",
        original: "/placeholder-product.png",
      },
      source: {
        source_id: "manual",
        source_name: "Manual Entry",
        imported_at: new Date(),
      },
      completeness_score: 30, // Basic score for required fields only
      critical_issues: ["Missing product image"], // Flag missing image as issue
      quality_data: {
        scores: {
          completeness: 30,
          accuracy: 100,
          richness: 0,
        },
        issues: ["Missing product image"],
      },
      analytics: {
        views_30d: 0,
        sales_30d: 0,
        conversion_rate: 0,
        priority_score: 50, // Default priority
      },
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      product: newProduct,
      entity_code: newProduct.entity_code,
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
