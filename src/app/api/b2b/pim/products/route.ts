import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/products
 * List products with filtering and pagination
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status");
    const sourceId = searchParams.get("source_id");
    const batchId = searchParams.get("batch_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const sortBy = searchParams.get("sort") || "priority"; // priority | score | updated

    // Advanced filters
    const entityCode = searchParams.get("entity_code");
    const sku = searchParams.get("sku");
    const brand = searchParams.get("brand");
    const category = searchParams.get("category");
    const currency = searchParams.get("currency");
    const priceMin = searchParams.get("price_min");
    const priceMax = searchParams.get("price_max");
    const scoreMin = searchParams.get("score_min");
    const scoreMax = searchParams.get("score_max");

    // Build query
    const query: any = {
      wholesaler_id: session.userId,
      isCurrent: true,
    };

    if (status) query.status = status;
    if (sourceId) query["source.source_id"] = sourceId;
    if (batchId) {
      // Support partial matching for batch ID
      query["source.batch_id"] = { $regex: batchId, $options: "i" };
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

    // Advanced filters
    if (entityCode) {
      query.entity_code = { $regex: entityCode, $options: "i" };
    }
    if (sku) {
      query.sku = { $regex: sku, $options: "i" };
    }
    if (brand) {
      query["brand.name"] = { $regex: brand, $options: "i" };
    }
    if (category) {
      query["category.name"] = { $regex: category, $options: "i" };
    }
    if (currency) {
      query.currency = currency;
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
