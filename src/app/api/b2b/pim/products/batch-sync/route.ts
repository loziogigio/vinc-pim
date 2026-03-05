/**
 * POST /api/b2b/pim/products/batch-sync - Execute batch sync (cleanup + resync)
 * GET  /api/b2b/pim/products/batch-sync - Get activity history
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  executeBatchSync,
  VALID_CLEANUP_MODES,
  VALID_REQUIRED_FIELDS,
  type CleanupMode,
  type RequiredField,
} from "@/lib/services/pim-batch-sync.service";

const MAX_BATCH_SIZE = 500;
const MIN_BATCH_SIZE = 10;
const DEFAULT_BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();

    // Validate cleanup_mode
    const cleanupMode = (body.cleanup_mode ?? "none") as CleanupMode;
    if (!VALID_CLEANUP_MODES.includes(cleanupMode)) {
      return NextResponse.json(
        {
          error: `Invalid cleanup_mode. Must be one of: ${VALID_CLEANUP_MODES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate cleanup_required_fields
    const requiredFields: RequiredField[] =
      body.cleanup_required_fields ?? [];
    for (const field of requiredFields) {
      if (!VALID_REQUIRED_FIELDS.includes(field as RequiredField)) {
        return NextResponse.json(
          {
            error: `Invalid field "${field}". Must be one of: ${VALID_REQUIRED_FIELDS.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate score ranges
    const cleanupMinScore = Math.max(0, Math.min(100, body.cleanup_min_score ?? 50));
    const resyncMinScore = Math.max(0, Math.min(100, body.resync_min_score ?? 70));

    // Clamp batch_size
    const batchSize = Math.max(
      MIN_BATCH_SIZE,
      Math.min(MAX_BATCH_SIZE, body.batch_size ?? DEFAULT_BATCH_SIZE)
    );

    const resync = body.resync ?? true;
    const dryRun = body.dry_run ?? true;

    // Must have at least one phase active
    if (cleanupMode === "none" && !resync) {
      return NextResponse.json(
        { error: "At least one phase (cleanup or resync) must be active" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    const result = await executeBatchSync({
      tenantId: auth.tenantId,
      tenantDb: auth.tenantDb,
      startedBy: auth.userId || auth.authMethod,
      cleanup_mode: cleanupMode,
      cleanup_min_score: cleanupMinScore,
      cleanup_required_fields: requiredFields,
      resync,
      resync_min_score: resyncMinScore,
      recalculate_scores: body.recalculate_scores ?? true,
      batch_size: batchSize,
      dry_run: dryRun,
    });

    const durationMs = Date.now() - startTime;

    // Update log with actual duration
    if (!dryRun && result.job_id) {
      const { BatchSyncLog } = await connectWithModels(auth.tenantDb);
      await BatchSyncLog.updateOne(
        { job_id: result.job_id },
        { $set: { duration_ms: durationMs } }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      duration_ms: durationMs,
    });
  } catch (error: any) {
    console.error("Error in batch sync:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { BatchSyncLog } = await connectWithModels(auth.tenantDb);

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (status && ["running", "completed", "failed"].includes(status)) {
      query.status = status;
    }

    const [items, total] = await Promise.all([
      BatchSyncLog.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BatchSyncLog.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching batch sync history:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
