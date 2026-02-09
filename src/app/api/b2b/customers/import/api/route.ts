/**
 * POST /api/b2b/customers/import/api
 *
 * Bulk customer import endpoint. Accepts a JSON array of customers,
 * creates an ImportJob, and queues processing to the customer-import worker.
 *
 * Supports:
 * - merge_mode: "replace" (default) or "partial"
 * - Customer tags and address tag_overrides
 * - Batch metadata for multi-part imports
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import { customerImportQueue } from "@/lib/queue/queues";

const MAX_BATCH_SIZE = 5000;

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const authMethod = req.headers.get("x-auth-method");
    let tenantId: string;
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "customers");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 },
        );
      }
      tenantId = apiKeyResult.tenantId!;
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantId = session.tenantId;
      tenantDb = `vinc-${session.tenantId}`;
    }

    const body = await req.json();
    const { customers, merge_mode = "replace", batch_id, batch_metadata } = body;

    // Validate customers array
    if (!customers || !Array.isArray(customers)) {
      return NextResponse.json(
        { error: "Missing or invalid customers array" },
        { status: 400 },
      );
    }

    if (customers.length === 0) {
      return NextResponse.json(
        { error: "Customers array is empty" },
        { status: 400 },
      );
    }

    if (customers.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many customers. Maximum ${MAX_BATCH_SIZE} per request` },
        { status: 400 },
      );
    }

    // Validate merge_mode
    if (merge_mode !== "replace" && merge_mode !== "partial") {
      return NextResponse.json(
        { error: 'Invalid merge_mode. Must be "replace" or "partial"' },
        { status: 400 },
      );
    }

    // Validate each customer has external_code
    const missingExternalCode = customers.findIndex(
      (c: { external_code?: string }) => !c.external_code,
    );
    if (missingExternalCode !== -1) {
      return NextResponse.json(
        {
          error: `Customer at index ${missingExternalCode} is missing external_code`,
        },
        { status: 400 },
      );
    }

    // Create ImportJob
    const { ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    const jobId = `cust_import_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await ImportJobModel.create({
      job_id: jobId,
      job_type: "customer_import",
      source_id: "customer-import-api",
      status: "pending",
      total_rows: customers.length,
      file_name: `Customer Import - ${customers.length} customers`,
      file_size: JSON.stringify(customers).length,
      ...(batch_metadata && {
        batch_id: batch_metadata.batch_id || batch_id,
        batch_part: batch_metadata.batch_part,
        batch_total_parts: batch_metadata.batch_total_parts,
        batch_total_items: batch_metadata.batch_total_items,
      }),
    });

    // Queue job for async processing
    await customerImportQueue.add("customer-import", {
      job_id: jobId,
      tenant_id: tenantId,
      merge_mode,
      customers,
      batch_metadata,
    });

    return NextResponse.json(
      {
        success: true,
        job_id: jobId,
        total: customers.length,
        merge_mode,
        message: `Queued ${customers.length} customers for import`,
      },
      { status: 202 },
    );
  } catch (error: any) {
    console.error("Error queuing customer import:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
