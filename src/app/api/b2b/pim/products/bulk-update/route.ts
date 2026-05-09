import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { importQueue } from "@/lib/queue/queues";
import { buildProductListQuery, type ProductFilterParams } from "@/lib/pim/product-query-builder";
import crypto from "crypto";

/**
 * POST /api/b2b/pim/products/bulk-update
 * Queue a bulk update job for selected products or all products matching filters
 *
 * Accepts one of:
 *   { product_ids: string[], updates }     — explicit selection by Mongo _id
 *   { entity_codes: string[], updates }    — explicit selection by entity_code (resolved server-side)
 *   { filters: ProductFilterParams, updates } — all matching filters
 *
 * Optional:
 *   sales_channels: string[] — sales channel codes to disable on when archiving.
 *                              Validated against the tenant's SalesChannel
 *                              collection (must exist and is_active=true).
 *                              Each code bundles its underlying tech: b2b/b2c
 *                              also flush Solr; ebay/amazon/etc. call their
 *                              adapter directly.
 *                              Defaults to every active sales channel for the
 *                              tenant. Only consulted when updates.status ===
 *                              "archived" or updates.not_visible === true.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantId, tenantDb } = auth;
    const { ImportJob: ImportJobModel, PIMProduct: PIMProductModel, SalesChannel: SalesChannelModel } =
      await connectWithModels(tenantDb);

    const body = await req.json();
    const { product_ids, entity_codes, filters, updates, sales_channels } = body;

    let resolvedSalesChannels: string[] | undefined;
    const isArchiveLike =
      updates && (updates.status === "archived" || updates.not_visible === true);

    if (sales_channels !== undefined) {
      if (!Array.isArray(sales_channels)) {
        return NextResponse.json(
          { error: "sales_channels must be an array" },
          { status: 400 }
        );
      }
      if (sales_channels.length > 0) {
        const activeChannels = await SalesChannelModel
          .find({ is_active: true })
          .select("code")
          .lean();
        const activeCodes = new Set(activeChannels.map((c: any) => c.code));
        const invalid = sales_channels.filter((c: any) => !activeCodes.has(c));
        if (invalid.length > 0) {
          return NextResponse.json(
            {
              error: `Invalid or inactive sales_channels: ${invalid.join(", ")}`,
              active_codes: [...activeCodes],
            },
            { status: 400 }
          );
        }
        resolvedSalesChannels = sales_channels;
      }
    } else if (isArchiveLike) {
      // Default: every active sales channel for the tenant.
      const activeChannels = await SalesChannelModel
        .find({ is_active: true })
        .select("code")
        .lean();
      resolvedSalesChannels = activeChannels.map((c: any) => c.code);
    }

    // Require one of product_ids, entity_codes, or filters
    const hasIds = product_ids && Array.isArray(product_ids) && product_ids.length > 0;
    const hasEntityCodes = entity_codes && Array.isArray(entity_codes) && entity_codes.length > 0;
    const hasFilters = filters && typeof filters === "object" && Object.keys(filters).length > 0;

    if (!hasIds && !hasEntityCodes && !hasFilters) {
      return NextResponse.json(
        { error: "One of product_ids, entity_codes, or filters is required" },
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

    // Determine total_rows and resolve entity_codes → _id when needed
    let totalRows: number;
    let resolvedProductIds: string[] | undefined;
    let unmatchedEntityCodes: string[] | undefined;

    if (hasFilters) {
      const query = await buildProductListQuery(filters as ProductFilterParams, tenantDb);
      totalRows = await PIMProductModel.countDocuments(query);
      if (totalRows === 0) {
        return NextResponse.json(
          { error: "No products match the provided filters" },
          { status: 400 }
        );
      }
    } else if (hasEntityCodes) {
      const docs = await PIMProductModel.find(
        { entity_code: { $in: entity_codes }, isCurrent: true },
        { _id: 1, entity_code: 1 }
      ).lean();
      resolvedProductIds = docs.map((d: any) => d._id.toString());
      const matchedCodes = new Set(docs.map((d: any) => d.entity_code));
      unmatchedEntityCodes = entity_codes.filter((c: string) => !matchedCodes.has(c));
      totalRows = resolvedProductIds.length;
      if (totalRows === 0) {
        return NextResponse.json(
          { error: "No products match the provided entity_codes", unmatched_entity_codes: unmatchedEntityCodes },
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

    // Queue the job — pass exactly one selector (filters | product_ids)
    const jobData: any = {
      job_id,
      job_type: "bulk_update",
      tenant_id: tenantId,
      updates,
    };
    if (hasFilters) {
      jobData.filters = filters;
    } else {
      jobData.product_ids = resolvedProductIds ?? product_ids;
    }
    if (resolvedSalesChannels && resolvedSalesChannels.length > 0) {
      jobData.sales_channels = resolvedSalesChannels;
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
      ...(unmatchedEntityCodes && unmatchedEntityCodes.length > 0
        ? { unmatched_entity_codes: unmatchedEntityCodes }
        : {}),
    });
  } catch (error) {
    console.error("Error queuing bulk update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
