import { NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ActivityLogModel } from "@/lib/db/models/activity-log";
import { B2BUserModel } from "@/lib/db/models/b2b-user";

export async function GET() {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Fetch recent activities with limit
    const activities = await ActivityLogModel.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Enrich with user names and time ago
    const enrichedActivities = await Promise.all(
      activities.map(async (activity: any) => {
        const user = await B2BUserModel.findById(activity.userId).select("username").lean() as { username: string } | null;
        const timeAgo = getTimeAgo(new Date(activity.createdAt));

        return {
          _id: activity._id.toString(),
          userId: activity.userId.toString(),
          userName: user?.username || "Unknown User",
          action: activity.action,
          description: activity.description,
          details: activity.details,
          createdAt: activity.createdAt,
          timeAgo,
        };
      })
    );

    return NextResponse.json({
      activities: enrichedActivities,
    });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
    return `${Math.floor(diffDay / 30)} months ago`;
  }
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "Just now";
}
