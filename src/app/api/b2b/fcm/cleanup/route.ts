/**
 * FCM Token Cleanup Endpoint
 *
 * GET  /api/b2b/fcm/cleanup - Preview what would be cleaned up
 * POST /api/b2b/fcm/cleanup - Run cleanup (with optional dry-run)
 *
 * This endpoint implements FCM token management best practices:
 * - Remove inactive tokens older than configurable threshold
 * - Remove anonymous tokens that were never associated with a user
 * - Remove tokens with persistent failures
 * - Remove stale tokens that haven't been used
 * - Remove duplicate tokens per device
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import {
  runFullCleanup,
  getCleanupStats,
  DEFAULT_CLEANUP_POLICIES,
  type CleanupPolicies,
} from "@/lib/fcm/cleanup.service";

/**
 * GET - Preview cleanup statistics
 *
 * Returns what would be deleted without actually deleting
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;

    // Get optional policy overrides from query params
    const { searchParams } = new URL(req.url);
    const policies: CleanupPolicies = {};

    if (searchParams.has("inactive_days")) {
      policies.inactiveDays = parseInt(searchParams.get("inactive_days")!, 10);
    }
    if (searchParams.has("anonymous_days")) {
      policies.anonymousDays = parseInt(searchParams.get("anonymous_days")!, 10);
    }
    if (searchParams.has("failed_days")) {
      policies.failedDays = parseInt(searchParams.get("failed_days")!, 10);
    }
    if (searchParams.has("stale_days")) {
      policies.staleDays = parseInt(searchParams.get("stale_days")!, 10);
    }

    const stats = await getCleanupStats(tenantDb, policies);

    return NextResponse.json({
      success: true,
      preview: true,
      stats,
      policies: {
        inactiveDays: policies.inactiveDays ?? DEFAULT_CLEANUP_POLICIES.INACTIVE_DAYS,
        anonymousDays: policies.anonymousDays ?? DEFAULT_CLEANUP_POLICIES.ANONYMOUS_DAYS,
        failedDays: policies.failedDays ?? DEFAULT_CLEANUP_POLICIES.FAILED_DAYS,
        staleDays: policies.staleDays ?? DEFAULT_CLEANUP_POLICIES.STALE_DAYS,
        maxFailures: DEFAULT_CLEANUP_POLICIES.MAX_FAILURES,
      },
      message: "Use POST to run actual cleanup",
    });
  } catch (error) {
    console.error("[fcm/cleanup] GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST - Run cleanup
 *
 * Body (optional):
 * {
 *   dry_run?: boolean,        // If true, return what would be deleted without deleting
 *   inactive_days?: number,   // Days before inactive tokens are deleted (default: 60)
 *   anonymous_days?: number,  // Days before anonymous tokens are deleted (default: 7)
 *   failed_days?: number,     // Days before failed tokens are deleted (default: 30)
 *   stale_days?: number,      // Days before stale tokens are deleted (default: 90)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;

    // Parse request body
    let body: {
      dry_run?: boolean;
      inactive_days?: number;
      anonymous_days?: number;
      failed_days?: number;
      stale_days?: number;
    } = {};

    try {
      body = await req.json();
    } catch {
      // No body, use defaults
    }

    const policies: CleanupPolicies = {
      inactiveDays: body.inactive_days,
      anonymousDays: body.anonymous_days,
      failedDays: body.failed_days,
      staleDays: body.stale_days,
    };

    // Dry run - just return stats
    if (body.dry_run) {
      const stats = await getCleanupStats(tenantDb, policies);
      return NextResponse.json({
        success: true,
        dry_run: true,
        stats,
        policies: {
          inactiveDays: policies.inactiveDays ?? DEFAULT_CLEANUP_POLICIES.INACTIVE_DAYS,
          anonymousDays: policies.anonymousDays ?? DEFAULT_CLEANUP_POLICIES.ANONYMOUS_DAYS,
          failedDays: policies.failedDays ?? DEFAULT_CLEANUP_POLICIES.FAILED_DAYS,
          staleDays: policies.staleDays ?? DEFAULT_CLEANUP_POLICIES.STALE_DAYS,
          maxFailures: DEFAULT_CLEANUP_POLICIES.MAX_FAILURES,
        },
        message: "Dry run - no tokens were deleted",
      });
    }

    // Run actual cleanup
    const result = await runFullCleanup(tenantDb, policies);

    return NextResponse.json({
      success: result.success,
      deleted: result.deleted,
      total_deleted: result.total,
      policies: {
        inactiveDays: policies.inactiveDays ?? DEFAULT_CLEANUP_POLICIES.INACTIVE_DAYS,
        anonymousDays: policies.anonymousDays ?? DEFAULT_CLEANUP_POLICIES.ANONYMOUS_DAYS,
        failedDays: policies.failedDays ?? DEFAULT_CLEANUP_POLICIES.FAILED_DAYS,
        staleDays: policies.staleDays ?? DEFAULT_CLEANUP_POLICIES.STALE_DAYS,
        maxFailures: DEFAULT_CLEANUP_POLICIES.MAX_FAILURES,
      },
      errors: result.errors,
    });
  } catch (error) {
    console.error("[fcm/cleanup] POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
