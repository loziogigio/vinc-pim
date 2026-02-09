/**
 * POST /api/b2b/portal-users/import/api
 *
 * Bulk portal user import endpoint. Accepts a JSON array of users,
 * creates an ImportJob, and queues processing to the portal-user-import worker.
 *
 * Supports:
 * - merge_mode: "replace" (default) or "partial"
 * - Password hashing (bcrypt) handled by worker
 * - customer_access linking
 * - Batch metadata for multi-part imports
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import { portalUserImportQueue } from "@/lib/queue/queues";

const MAX_BATCH_SIZE = 5000;

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const authMethod = req.headers.get("x-auth-method");
    let tenantId: string;
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "portal-users");
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
    const { users, merge_mode = "replace", batch_id, batch_metadata } = body;

    // Validate users array
    if (!users || !Array.isArray(users)) {
      return NextResponse.json(
        { error: "Missing or invalid users array" },
        { status: 400 },
      );
    }

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Users array is empty" },
        { status: 400 },
      );
    }

    if (users.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many users. Maximum ${MAX_BATCH_SIZE} per request` },
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

    // Validate each user has username
    const missingUsername = users.findIndex(
      (u: { username?: string }) => !u.username,
    );
    if (missingUsername !== -1) {
      return NextResponse.json(
        {
          error: `User at index ${missingUsername} is missing username`,
        },
        { status: 400 },
      );
    }

    // Create ImportJob
    const { ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    const jobId = `pu_import_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await ImportJobModel.create({
      job_id: jobId,
      job_type: "portal_user_import",
      source_id: "portal-user-import-api",
      status: "pending",
      total_rows: users.length,
      file_name: `Portal User Import - ${users.length} users`,
      file_size: JSON.stringify(users).length,
      ...(batch_metadata && {
        batch_id: batch_metadata.batch_id || batch_id,
        batch_part: batch_metadata.batch_part,
        batch_total_parts: batch_metadata.batch_total_parts,
        batch_total_items: batch_metadata.batch_total_items,
      }),
    });

    // Queue job for async processing
    await portalUserImportQueue.add("portal-user-import", {
      job_id: jobId,
      tenant_id: tenantId,
      merge_mode,
      users,
      batch_metadata,
    });

    return NextResponse.json(
      {
        success: true,
        job_id: jobId,
        total: users.length,
        merge_mode,
        message: `Queued ${users.length} portal users for import`,
      },
      { status: 202 },
    );
  } catch (error: any) {
    console.error("Error queuing portal user import:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
