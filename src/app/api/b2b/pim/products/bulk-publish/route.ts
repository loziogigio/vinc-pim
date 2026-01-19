import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { calculateCompletenessScore, findCriticalIssues } from "@/lib/pim/scorer";

/**
 * POST /api/b2b/pim/products/bulk-publish
 * Bulk publish products based on completeness score threshold
 *
 * Body:
 * - min_score: number (default: 80) - Minimum completeness score to publish
 * - dry_run: boolean (default: true) - If true, only return count without publishing
 * - max_items: number (optional) - Limit number of items to publish
 * - recalculate_scores: boolean (default: true) - Recalculate scores before publishing
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const {
      min_score = 80,
      dry_run = true,
      max_items,
      recalculate_scores = true,
    } = body;

    console.log(`📦 Bulk publish request: min_score=${min_score}, dry_run=${dry_run}, max_items=${max_items || "unlimited"}`);

    // Find all draft products that are current versions
    const query: any = {
      isCurrent: true,
      status: "draft",
    };

    // If not recalculating, use stored score for initial filter
    if (!recalculate_scores) {
      query.completeness_score = { $gte: min_score };
    }

    const drafts = await PIMProductModel.find(query)
      .limit(max_items ? max_items * 2 : 0) // Fetch extra if recalculating (some may not qualify)
      .lean() as any[];

    console.log(`📋 Found ${drafts.length} draft products to evaluate`);

    // Recalculate scores and filter eligible products
    const eligibleProducts: any[] = [];
    const scoreUpdates: { entity_code: string; oldScore: number; newScore: number }[] = [];

    for (const product of drafts) {
      let score = product.completeness_score || 0;
      let issues = product.critical_issues || [];

      // Recalculate score if requested
      if (recalculate_scores) {
        score = calculateCompletenessScore(product);
        issues = findCriticalIssues(product);

        // Track score changes
        if (score !== product.completeness_score) {
          scoreUpdates.push({
            entity_code: product.entity_code,
            oldScore: product.completeness_score || 0,
            newScore: score,
          });
        }
      }

      // Check if product meets threshold
      if (score >= min_score) {
        eligibleProducts.push({
          ...product,
          completeness_score: score,
          critical_issues: issues,
        });

        // Stop if we've reached max_items
        if (max_items && eligibleProducts.length >= max_items) {
          break;
        }
      }
    }

    console.log(`✅ ${eligibleProducts.length} products eligible for publishing (score >= ${min_score})`);

    // If dry run, just return the count and details
    if (dry_run) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        message: `${eligibleProducts.length} products would be published`,
        min_score,
        eligible_count: eligibleProducts.length,
        score_updates: scoreUpdates.length,
        eligible_products: eligibleProducts.slice(0, 20).map((p) => ({
          entity_code: p.entity_code,
          sku: p.sku,
          name: typeof p.name === "string" ? p.name : p.name?.it || p.name?.en || Object.values(p.name || {})[0],
          completeness_score: p.completeness_score,
          critical_issues_count: p.critical_issues?.length || 0,
        })),
        total_drafts: drafts.length,
      });
    }

    // Actually publish the products
    const publishedAt = new Date();
    const publishResults: { entity_code: string; success: boolean; error?: string }[] = [];

    for (const product of eligibleProducts) {
      try {
        await PIMProductModel.updateOne(
          { entity_code: product.entity_code, isCurrent: true },
          {
            $set: {
              status: "published",
              published_at: publishedAt,
              isCurrentPublished: true,
              completeness_score: product.completeness_score,
              critical_issues: product.critical_issues,
              updated_at: publishedAt,
            },
          }
        );

        publishResults.push({ entity_code: product.entity_code, success: true });
      } catch (error: any) {
        console.error(`❌ Failed to publish ${product.entity_code}:`, error.message);
        publishResults.push({
          entity_code: product.entity_code,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = publishResults.filter((r) => r.success).length;
    const failedCount = publishResults.filter((r) => !r.success).length;

    console.log(`🎉 Bulk publish complete: ${successCount} published, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      dry_run: false,
      message: `${successCount} products published successfully`,
      min_score,
      published_count: successCount,
      failed_count: failedCount,
      score_updates: scoreUpdates.length,
      results: publishResults,
    });
  } catch (error: any) {
    console.error("Error in bulk publish:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/b2b/pim/products/bulk-publish
 * Get stats about products eligible for bulk publish
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const searchParams = req.nextUrl.searchParams;
    const minScore = parseInt(searchParams.get("min_score") || "80");

    // Get counts at different score thresholds
    const thresholds = [60, 70, 80, 90, 100];
    const stats: Record<number, number> = {};

    for (const threshold of thresholds) {
      const count = await PIMProductModel.countDocuments({
        isCurrent: true,
        status: "draft",
        completeness_score: { $gte: threshold },
      });
      stats[threshold] = count;
    }

    // Get total draft count
    const totalDrafts = await PIMProductModel.countDocuments({
      isCurrent: true,
      status: "draft",
    });

    // Get total published count
    const totalPublished = await PIMProductModel.countDocuments({
      isCurrent: true,
      status: "published",
    });

    return NextResponse.json({
      success: true,
      stats: {
        total_drafts: totalDrafts,
        total_published: totalPublished,
        eligible_by_threshold: stats,
        recommended_threshold: minScore,
        eligible_at_recommended: stats[minScore] || 0,
      },
    });
  } catch (error: any) {
    console.error("Error getting bulk publish stats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
