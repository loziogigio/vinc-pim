"use client";

import { Clock } from "lucide-react";
import type { ActivityLog } from "@/lib/types/b2b";

type RecentActivityPanelProps = {
  activities: Array<ActivityLog & { timeAgo: string }>;
};

export function RecentActivityPanel({ activities }: RecentActivityPanelProps) {
  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>

      <div className="space-y-1.5">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity</p>
        ) : (
          activities.map((activity) => (
            <div
              key={activity._id}
              className="rounded-lg bg-muted/30 p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {activity.timeAgo}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground">
                    {activity.description}
                  </p>
                  {activity.details?.count && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {activity.details.count} items affected
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
