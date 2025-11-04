import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { ImportJobModel } from "@/lib/db/models/import-job";

/**
 * GET /api/b2b/pim/stats
 * Get dashboard statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const wholesaler_id = session.userId;

    // Get product stats
    const [
      totalProducts,
      publishedCount,
      draftCount,
      criticalIssuesCount,
      avgScore,
      autoPublishedToday,
      pendingImports,
    ] = await Promise.all([
      // Total products (current versions only)
      PIMProductModel.countDocuments({
        wholesaler_id,
        isCurrent: true,
      }),

      // Published products
      PIMProductModel.countDocuments({
        wholesaler_id,
        isCurrent: true,
        status: "published",
      }),

      // Draft products
      PIMProductModel.countDocuments({
        wholesaler_id,
        isCurrent: true,
        status: "draft",
      }),

      // Products with critical issues
      PIMProductModel.countDocuments({
        wholesaler_id,
        isCurrent: true,
        critical_issues: { $exists: true, $ne: [] },
      }),

      // Average completeness score
      PIMProductModel.aggregate([
        {
          $match: {
            wholesaler_id,
            isCurrent: true,
          },
        },
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$completeness_score" },
          },
        },
      ]).then((result) =>
        result.length > 0 ? Math.round(result[0].avgScore) : 0
      ),

      // Auto-published today
      PIMProductModel.countDocuments({
        wholesaler_id,
        isCurrent: true,
        status: "published",
        auto_publish_eligible: true,
        published_at: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),

      // Pending imports
      ImportJobModel.countDocuments({
        wholesaler_id,
        status: { $in: ["pending", "processing"] },
      }),
    ]);

    return NextResponse.json({
      total_products: totalProducts,
      published_count: publishedCount,
      draft_count: draftCount,
      critical_issues_count: criticalIssuesCount,
      avg_completeness_score: avgScore,
      auto_published_today: autoPublishedToday,
      pending_imports: pendingImports,
    });
  } catch (error) {
    console.error("Error fetching PIM stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
