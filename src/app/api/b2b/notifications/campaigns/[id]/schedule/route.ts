/**
 * Campaign Schedule API
 *
 * POST /api/b2b/notifications/campaigns/[id]/schedule - Schedule a draft campaign
 * DELETE /api/b2b/notifications/campaigns/[id]/schedule - Cancel scheduled campaign
 *
 * Uses two-tier scheduling:
 * - PRIMARY: BullMQ delayed job (exact timing)
 * - FALLBACK: Polling every 5 min catches missed jobs after Redis restart
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import {
  scheduleCampaign,
  cancelScheduledCampaign,
} from "@/lib/services/campaign.service";

/**
 * POST - Schedule a draft campaign for future delivery
 *
 * Uses BullMQ delayed job for precise timing.
 * Fallback polling catches jobs lost after Redis restart.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb || !auth.tenantId) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { scheduled_at } = await req.json();

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "scheduled_at is required" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Must be at least 5 minutes in the future
    const minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() + 5);

    if (scheduledDate < minDate) {
      return NextResponse.json(
        { error: "Scheduled time must be at least 5 minutes in the future" },
        { status: 400 }
      );
    }

    // Use service function (creates BullMQ delayed job + updates campaign)
    const result = await scheduleCampaign(
      auth.tenantDb,
      auth.tenantId,
      id,
      scheduledDate
    );

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      campaign_id: result.campaign_id,
      scheduled_at: result.scheduled_at,
      job_id: result.job_id,
      delay_minutes: result.delay_minutes,
      message: `Campaign scheduled for ${result.scheduled_at.toISOString()} (in ${result.delay_minutes} minutes)`,
    });
  } catch (error) {
    console.error("Error scheduling campaign:", error);
    return NextResponse.json(
      { error: "Failed to schedule campaign" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel a scheduled campaign (back to draft)
 *
 * Removes the BullMQ delayed job and reverts campaign to draft.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Use service function (removes BullMQ job + updates campaign)
    const result = await cancelScheduledCampaign(auth.tenantDb, id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign unscheduled, reverted to draft",
    });
  } catch (error) {
    console.error("Error unscheduling campaign:", error);
    return NextResponse.json(
      { error: "Failed to unschedule campaign" },
      { status: 500 }
    );
  }
}
