/**
 * Direct Solr Sync API Route
 * POST /api/b2b/pim/products/[entity_code]/sync
 * Immediately syncs product to Solr without queueing a job
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { SolrAdapter } from "@/lib/adapters/solr-adapter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const { entity_code } = await params;

    await connectToDatabase();

    // Get the current version of the product
    const product = await PIMProductModel.findOne({
      entity_code,
      isCurrent: true,
    }).lean();

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Only sync published products
    if (product.status !== "published") {
      return NextResponse.json(
        {
          success: false,
          error: "Only published products can be synced to Solr",
          status: product.status,
        },
        { status: 400 }
      );
    }

    // Initialize Solr adapter
    // Core name matches MongoDB database name
    const solrAdapter = new SolrAdapter({
      enabled: true,
      custom_config: {
        solr_url: process.env.SOLR_URL || "http://localhost:8983/solr",
        solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE || "mycore",
      },
    });

    await solrAdapter.initialize();

    // Perform direct sync to Solr
    const result = await solrAdapter.syncProduct(product as any);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to sync to Solr",
          message: result.message,
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    // Update the last_synced_at timestamp
    await PIMProductModel.updateOne(
      { _id: product._id },
      {
        $set: {
          "analytics.last_synced_at": new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Product synced to Solr successfully",
      entity_code,
      synced_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Direct Solr sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync to Solr",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
