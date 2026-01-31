/**
 * Campaign Results API
 *
 * GET /api/b2b/notifications/campaigns/[id]/results - Get campaign results
 *
 * Returns detailed results per channel for a sent campaign.
 * Response format matches CampaignResults component interface.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { getCampaignStats } from "@/lib/notifications/notification-log.service";
import type { NotificationChannel } from "@/lib/constants/notification";

interface ChannelResults {
  sent: number;
  failed: number;
  opened?: number;
  clicked?: number;
  read?: number;
}

export async function GET(
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

    const campaign = await Campaign.findOne({ campaign_id: id })
      .select("campaign_id name status type title channels recipient_type recipient_count sent_at results")
      .lean();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only sent campaigns have results
    if (!["sent", "sending"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Campaign has not been sent yet" },
        { status: 400 }
      );
    }

    // Get live stats from unified notification log (with platform separation)
    const liveStats = await getCampaignStats(id);

    // Build results by display channel: email, mobile_app, web
    // - email: Email channel tracking
    // - mobile_app: In-app notifications tracked from Flutter/mobile (platform: "mobile")
    // - web: In-app notifications tracked from web browser (platform: "web")
    const results: {
      email?: ChannelResults;
      mobile_app?: ChannelResults;
      web?: ChannelResults;
    } = {};

    const channels = campaign.channels as NotificationChannel[];
    const hasInAppChannel = channels.includes("web_in_app") || channels.includes("mobile");

    // Email channel
    if (channels.includes("email")) {
      results.email = {
        sent: liveStats.email.sent,
        failed: liveStats.email.failed,
        opened: liveStats.email.opened,
        clicked: liveStats.email.clicked,
      };
    }

    // Mobile App tracking (in-app notifications tracked from mobile platform)
    if (hasInAppChannel) {
      results.mobile_app = {
        sent: liveStats.mobile_app.sent,
        failed: liveStats.mobile_app.failed,
        opened: liveStats.mobile_app.opened,
        clicked: liveStats.mobile_app.clicked,
        read: liveStats.mobile_app.read,
      };
    }

    // Web tracking (in-app notifications tracked from web platform)
    if (hasInAppChannel) {
      results.web = {
        sent: liveStats.web.sent,
        failed: liveStats.web.failed,
        opened: liveStats.web.opened,
        clicked: liveStats.web.clicked,
        read: liveStats.web.read,
      };
    }

    // Calculate totals (email sent + web_in_app sent, avoid double counting mobile_app/web)
    const emailSent = liveStats.email.sent;
    const inAppSent = liveStats.mobile_app.sent; // Same as web.sent (shared)
    const totalSent = emailSent + inAppSent;

    const emailFailed = liveStats.email.failed;
    const inAppFailed = liveStats.mobile_app.failed; // Same as web.failed (shared)
    const totalFailed = emailFailed + inAppFailed;

    const total = totalSent + totalFailed;

    const totals: {
      sent: number;
      failed: number;
      delivery_rate: number;
      open_rate?: number;
      click_rate?: number;
    } = {
      sent: totalSent,
      failed: totalFailed,
      delivery_rate: total > 0 ? totalSent / total : 0,
    };

    // Add open_rate based on all channels (combining mobile + web opens)
    const totalOpened = liveStats.email.opened + liveStats.mobile_app.opened + liveStats.web.opened;
    if (totalSent > 0) {
      totals.open_rate = Math.min(totalOpened / totalSent, 1);
    }

    // Add click_rate based on all channels
    const totalClicks = liveStats.email.clicked + liveStats.mobile_app.clicked + liveStats.web.clicked;
    if (totalSent > 0) {
      totals.click_rate = Math.min(totalClicks / totalSent, 1);
    }

    return NextResponse.json({
      campaign_id: campaign.campaign_id,
      name: campaign.name || campaign.title,
      status: campaign.status,
      sent_at: campaign.sent_at,
      recipient_count: campaign.recipient_count || 0,
      channels,
      results,
      totals,
    });
  } catch (error) {
    console.error("Error fetching campaign results:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign results" },
      { status: 500 }
    );
  }
}
