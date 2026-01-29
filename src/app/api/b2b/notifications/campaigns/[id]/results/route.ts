/**
 * Campaign Results API
 *
 * GET /api/b2b/notifications/campaigns/[id]/results - Get campaign results
 *
 * Returns detailed results per channel for a sent campaign.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { Campaign } = await connectWithModels(tenantDb);

    const campaign = await Campaign.findOne({ campaign_id: id })
      .select("campaign_id status type title channels recipient_type recipient_count sent_at results")
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

    // Calculate summary metrics
    const results = campaign.results || {
      email: { sent: 0, failed: 0, opened: 0, clicked: 0 },
      mobile: { sent: 0, failed: 0, clicked: 0 },
      web_in_app: { sent: 0, failed: 0, read: 0 },
    };

    const summary = {
      total_recipients: campaign.recipient_count || 0,
      total_sent: results.email.sent + results.mobile.sent + results.web_in_app.sent,
      total_failed: results.email.failed + results.mobile.failed + results.web_in_app.failed,
      channels_used: campaign.channels,
    };

    // Calculate rates per channel
    const channelMetrics: Record<string, unknown> = {};

    if (campaign.channels.includes("email")) {
      const emailTotal = results.email.sent + results.email.failed;
      channelMetrics.email = {
        sent: results.email.sent,
        failed: results.email.failed,
        opened: results.email.opened,
        clicked: results.email.clicked,
        delivery_rate: emailTotal > 0 ? Math.round((results.email.sent / emailTotal) * 100) : 0,
        open_rate: results.email.sent > 0 ? Math.round((results.email.opened / results.email.sent) * 100) : 0,
        click_rate: results.email.sent > 0 ? Math.round((results.email.clicked / results.email.sent) * 100) : 0,
      };
    }

    if (campaign.channels.includes("mobile")) {
      const mobileTotal = results.mobile.sent + results.mobile.failed;
      channelMetrics.mobile = {
        sent: results.mobile.sent,
        failed: results.mobile.failed,
        clicked: results.mobile.clicked,
        delivery_rate: mobileTotal > 0 ? Math.round((results.mobile.sent / mobileTotal) * 100) : 0,
        click_rate: results.mobile.sent > 0 ? Math.round((results.mobile.clicked / results.mobile.sent) * 100) : 0,
      };
    }

    if (campaign.channels.includes("web_in_app")) {
      const webTotal = results.web_in_app.sent + results.web_in_app.failed;
      channelMetrics.web_in_app = {
        sent: results.web_in_app.sent,
        failed: results.web_in_app.failed,
        read: results.web_in_app.read,
        delivery_rate: webTotal > 0 ? Math.round((results.web_in_app.sent / webTotal) * 100) : 0,
        read_rate: results.web_in_app.sent > 0 ? Math.round((results.web_in_app.read / results.web_in_app.sent) * 100) : 0,
      };
    }

    return NextResponse.json({
      campaign_id: campaign.campaign_id,
      status: campaign.status,
      type: campaign.type,
      title: campaign.title,
      sent_at: campaign.sent_at,
      summary,
      channels: channelMetrics,
    });
  } catch (error) {
    console.error("Error fetching campaign results:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign results" },
      { status: 500 }
    );
  }
}
