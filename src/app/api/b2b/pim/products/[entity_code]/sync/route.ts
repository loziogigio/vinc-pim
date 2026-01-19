/**
 * Direct Solr Sync API Route
 * POST /api/b2b/pim/products/[entity_code]/sync
 * Immediately syncs product to Solr without queueing a job
 * Supports both B2B session and API key authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const { entity_code } = await params;

    let tenantId: string;
    let tenantDb: string;

    // Check for API key auth first
    const authMethod = request.headers.get("x-auth-method");
    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(request, "pim");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { success: false, error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantId = apiKeyResult.tenantId!;
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      // Fall back to B2B session auth
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
      tenantId = session.tenantId;
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    // Get the current version of the product
    const product: any = await PIMProductModel.findOne({
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

    // Initialize Solr adapter (config from loadAdapterConfigs - single source of truth)
    const adapterConfigs = loadAdapterConfigs(tenantId);
    const solrAdapter = new SolrAdapter(adapterConfigs.solr);
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
