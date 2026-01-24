/**
 * Notification Stats API
 *
 * GET /api/b2b/notifications/stats - Get dashboard statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

interface StatsResponse {
  sent_today: number;
  sent_this_week: number;
  sent_this_month: number;
  open_rate: number;
  click_rate: number;
  failed_today: number;
  by_status: {
    sent: number;
    failed: number;
    queued: number;
    bounced: number;
  };
  by_channel: {
    email: {
      sent: number;
      open_rate: number;
    };
    web_push: {
      sent: number;
      click_rate: number;
    };
    mobile_push: {
      sent: number;
      click_rate: number;
    };
    sms: {
      sent: number;
    };
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { EmailLog } = await connectWithModels(tenantDb);

    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(todayStart);
    monthAgo.setDate(monthAgo.getDate() - 30);

    // Get aggregated stats
    const [
      sentToday,
      sentThisWeek,
      sentThisMonth,
      failedToday,
      totalWithOpens,
      totalWithClicks,
      statusCounts,
    ] = await Promise.all([
      // Sent today
      EmailLog.countDocuments({
        status: "sent",
        created_at: { $gte: todayStart },
      }),

      // Sent this week
      EmailLog.countDocuments({
        status: "sent",
        created_at: { $gte: weekAgo },
      }),

      // Sent this month
      EmailLog.countDocuments({
        status: "sent",
        created_at: { $gte: monthAgo },
      }),

      // Failed today
      EmailLog.countDocuments({
        status: "failed",
        created_at: { $gte: todayStart },
      }),

      // Total with opens (last 30 days)
      EmailLog.countDocuments({
        status: "sent",
        open_count: { $gt: 0 },
        created_at: { $gte: monthAgo },
      }),

      // Total with clicks (last 30 days)
      EmailLog.countDocuments({
        status: "sent",
        click_count: { $gt: 0 },
        created_at: { $gte: monthAgo },
      }),

      // Status counts (last 30 days)
      EmailLog.aggregate([
        { $match: { created_at: { $gte: monthAgo } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    // Calculate rates
    const openRate = sentThisMonth > 0 ? Math.round((totalWithOpens / sentThisMonth) * 1000) / 10 : 0;
    const clickRate = sentThisMonth > 0 ? Math.round((totalWithClicks / sentThisMonth) * 1000) / 10 : 0;

    // Transform status counts
    const byStatus = {
      sent: 0,
      failed: 0,
      queued: 0,
      bounced: 0,
    };
    statusCounts.forEach((item: { _id: string; count: number }) => {
      if (item._id in byStatus) {
        byStatus[item._id as keyof typeof byStatus] = item.count;
      }
    });

    // By channel stats (email only for now)
    const byChannel = {
      email: {
        sent: sentThisMonth,
        open_rate: openRate,
      },
      web_push: {
        sent: 0,
        click_rate: 0,
      },
      mobile_push: {
        sent: 0,
        click_rate: 0,
      },
      sms: {
        sent: 0,
      },
    };

    const stats: StatsResponse = {
      sent_today: sentToday,
      sent_this_week: sentThisWeek,
      sent_this_month: sentThisMonth,
      open_rate: openRate,
      click_rate: clickRate,
      failed_today: failedToday,
      by_status: byStatus,
      by_channel: byChannel,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
