import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { importQueue } from "@/lib/queue/queues";
import { buildProductListQuery, type ProductFilterParams } from "@/lib/pim/product-query-builder";
import crypto from "crypto";

/**
 * POST /api/b2b/pim/products/bulk-update
 * Queue a bulk update job for selected products or all products matching filters
 *
 * Accepts either:
 *   { product_ids: string[], updates }  — explicit selection
 *   { filters: ProductFilterParams, updates }  — all matching filters
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ImportJob: ImportJobModel, PIMProduct: PIMProductModel } =
      await connectWithModels(tenantDb);

    const body = await req.json();
    const { product_ids, filters, updates } = body;

    // Require either product_ids or filters
    const hasIds = product_ids && Array.isArray(product_ids) && product_ids.length > 0;
    const hasFilters = filters && typeof filters === "object" && Object.keys(filters).length > 0;

    if (!hasIds && !hasFilters) {
      return NextResponse.json(
        { error: "Either product_ids array or filters object is required" },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "updates object is required" },
        { status: 400 }
      );
    }

    // Validate updates
    if (updates.status && !["draft", "published", "archived"].includes(updates.status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Determine total_rows
    let totalRows: number;
    if (hasFilters) {
      const query = await buildProductListQuery(filters as ProductFilterParams, tenantDb);
      totalRows = await PIMProductModel.countDocuments(query);
      if (totalRows === 0) {
        return NextResponse.json(
          { error: "No products match the provided filters" },
          { status: 400 }
        );
      }
    } else {
      totalRows = product_ids.length;
    }

    // Generate job ID
    const job_id = `bulk-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Create job record
    await ImportJobModel.create({
      job_id,
      job_type: "bulk_update",
      source_id: "bulk-update",
      status: "pending",
      total_rows: totalRows,
      processed_rows: 0,
      successful_rows: 0,
      failed_rows: 0,
      auto_published_count: 0,
      import_errors: [],
    });

    // Queue the job — pass either product_ids or filters (not both)
    const jobData: any = {
      job_id,
      job_type: "bulk_update",
      tenant_id: session.tenantId,
      updates,
    };
    if (hasFilters) {
      jobData.filters = filters;
    } else {
      jobData.product_ids = product_ids;
    }

    await importQueue.add("bulk-update", jobData, {
      jobId: job_id,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });

    return NextResponse.json({
      success: true,
      job_id,
      message: `Bulk update job queued for ${totalRows} product${
        totalRows !== 1 ? "s" : ""
      }`,
    });
  } catch (error) {
    console.error("Error queuing bulk update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
