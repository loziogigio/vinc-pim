/**
 * Campaign Schedule API
 *
 * POST /api/b2b/notifications/campaigns/[id]/schedule - Schedule a draft campaign
 * DELETE /api/b2b/notifications/campaigns/[id]/schedule - Unschedule (back to draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

/**
 * POST - Schedule a draft campaign for future delivery
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = auth.tenantDb;
    const { scheduled_at } = await req.json();

    if (!scheduled_at) {
      return NextResponse.json({ error: "scheduled_at is required" }, { status: 400 });
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
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

    const { Campaign } = await connectWithModels(tenantDb);

    const campaign = await Campaign.findOne({ campaign_id: id });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only draft campaigns can be scheduled
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft campaigns can be scheduled" },
        { status: 400 }
      );
    }

    // Update campaign
    campaign.status = "scheduled";
    campaign.scheduled_at = scheduledDate;
    campaign.updated_by = auth.userId || auth.email;

    await campaign.save();

    return NextResponse.json({
      success: true,
      campaign: {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        status: campaign.status,
        scheduled_at: campaign.scheduled_at,
      },
      message: "Campaign scheduled successfully",
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
 * DELETE - Unschedule a campaign (back to draft)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = auth.tenantDb;
    const { Campaign } = await connectWithModels(tenantDb);

    const campaign = await Campaign.findOne({ campaign_id: id });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only scheduled campaigns can be unscheduled
    if (campaign.status !== "scheduled") {
      return NextResponse.json(
        { error: "Only scheduled campaigns can be unscheduled" },
        { status: 400 }
      );
    }

    // Update campaign
    campaign.status = "draft";
    campaign.scheduled_at = undefined;
    campaign.updated_by = auth.userId || auth.email;

    await campaign.save();

    return NextResponse.json({
      success: true,
      campaign: {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        status: campaign.status,
      },
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
