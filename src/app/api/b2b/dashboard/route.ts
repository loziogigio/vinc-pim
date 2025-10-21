import { NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { B2BProductModel } from "@/lib/db/models/b2b-product";
import { ActivityLogModel } from "@/lib/db/models/activity-log";
import type { CatalogOverview } from "@/lib/types/b2b";

export async function GET() {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Get catalog overview
    const totalProducts = await B2BProductModel.countDocuments();
    const enhancedProducts = await B2BProductModel.countDocuments({ status: "enhanced" });
    const needsAttention = await B2BProductModel.countDocuments({ status: "needs_attention" });
    const missingImages = await B2BProductModel.countDocuments({ images: { $size: 0 } });
    const missingMarketing = await B2BProductModel.countDocuments({
      $or: [
        { marketingContent: { $exists: false } },
        { marketingContent: "" },
      ],
    });

    // Get most recent sync date
    const lastSyncedProduct = await B2BProductModel.findOne({ lastSyncedAt: { $exists: true } })
      .sort({ lastSyncedAt: -1 })
      .select("lastSyncedAt")
      .lean() as { lastSyncedAt: Date } | null;

    const overview: CatalogOverview = {
      totalProducts,
      enhancedProducts,
      needsAttention,
      missingImages,
      missingMarketing,
      recentSync: lastSyncedProduct?.lastSyncedAt,
    };

    // Get recent activities
    const recentActivities = await ActivityLogModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Calculate time ago for activities
    const activitiesWithTimeAgo = recentActivities.map((activity: any) => {
      const now = new Date();
      const created = new Date(activity.createdAt);
      const diffMs = now.getTime() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo: string;
      if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
      } else if (diffDays === 1) {
        timeAgo = "Yesterday";
      } else {
        timeAgo = `${diffDays}d ago`;
      }

      return {
        ...activity,
        _id: activity._id.toString(),
        timeAgo,
      };
    });

    return NextResponse.json({
      overview,
      activities: activitiesWithTimeAgo,
    });
  } catch (error) {
    console.error("Dashboard data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
