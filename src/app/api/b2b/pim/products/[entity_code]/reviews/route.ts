import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getPooledConnection } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

/**
 * GET /api/b2b/pim/products/[entity_code]/reviews
 * Returns Drupal-sourced editorial reviews for a ship product.
 *
 * Response:
 * {
 *   reviews: [{ id, author, rating, ratings, pro, con, verified, date }],
 *   average,
 *   count
 * }
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

    const { entity_code } = await params;

    const connection = await getPooledConnection(tenantDb);
    const db = connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    // Fetch reviews for this product, newest first (created_at is unix timestamp)
    const rawReviews = await db
      .collection("reviews")
      .find({ product_entity_code: entity_code })
      .sort({ created_at: -1 })
      .toArray();

    const reviews = rawReviews.map((r: any) => ({
      id: r.review_id,
      author: r.is_anonymous ? null : r.reviewer_name,
      rating: r.rating_average ?? null,
      ratings: r.ratings ?? null,
      pro: r.pro ?? null,
      con: r.con ?? null,
      verified: !!r.is_verified,
      date: r.created_at ?? null,
    }));

    // Pull average/count from the matching ship PIMProduct if available
    const product = await db.collection("pimproducts").findOne(
      { entity_code, isCurrent: true },
      { projection: { reviews_average: 1, reviews_count: 1 } }
    );

    let average: number;
    let count: number;

    if (product && typeof product.reviews_count === "number") {
      average = product.reviews_average ?? 0;
      count = product.reviews_count;
    } else {
      // Fallback: compute from the fetched reviews
      const rated = reviews
        .map((r) => r.rating)
        .filter((v): v is number => typeof v === "number");
      count = reviews.length;
      average =
        rated.length > 0
          ? rated.reduce((sum, v) => sum + v, 0) / rated.length
          : 0;
    }

    return NextResponse.json({ reviews, average, count });
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
