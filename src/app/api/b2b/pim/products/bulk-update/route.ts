import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { importQueue } from "@/lib/queue/queues";
import { ImportJobModel } from "@/lib/db/models/import-job";
import crypto from "crypto";

/**
 * POST /api/b2b/pim/products/bulk-update
 * Queue a bulk update job for selected products
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { product_ids, updates } = body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json(
        { error: "product_ids array is required" },
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

    // Generate job ID
    const job_id = `bulk-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Create job record
    await ImportJobModel.create({
      job_id,
      job_type: "bulk_update",
      wholesaler_id: session.userId,
      source_id: "bulk-update",
      status: "pending",
      total_rows: product_ids.length,
      processed_rows: 0,
      successful_rows: 0,
      failed_rows: 0,
      auto_published_count: 0,
      import_errors: [],
    });

    // Queue the job
    await importQueue.add(
      "bulk-update",
      {
        job_id,
        job_type: "bulk_update",
        wholesaler_id: session.userId,
        product_ids,
        updates,
      },
      {
        jobId: job_id,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    return NextResponse.json({
      success: true,
      job_id,
      message: `Bulk update job queued for ${product_ids.length} product${
        product_ids.length !== 1 ? "s" : ""
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
