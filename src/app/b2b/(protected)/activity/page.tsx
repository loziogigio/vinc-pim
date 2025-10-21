"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BackButton } from "@/components/b2b/BackButton";
import { Clock, User, Package, Settings } from "lucide-react";
import type { ActivityLog } from "@/lib/types/b2b";

type ActivityData = {
  activities: Array<ActivityLog & { timeAgo: string; userName: string }>;
};

export default function B2BActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch("/api/b2b/activity", { cache: "no-store" });
        if (!res.ok) {
          console.warn("Failed to fetch activities", res.status, res.statusText);
          setData({ activities: [] });
          return;
        }
        const activityData = await res.json();
        setData(activityData);
      } catch (error) {
        console.error("Activity fetch error:", error);
        setData({ activities: [] });
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivities();
  }, []);

  const getActionIcon = (action: string) => {
    if (action.includes("product")) return Package;
    if (action.includes("user")) return User;
    if (action.includes("config") || action.includes("setting")) return Settings;
    return Clock;
  };

  const renderEmptyState = (message: string, sub?: string) => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <p className="text-[1.05rem] font-semibold">{message}</p>
        {sub ? <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{sub}</p> : null}
      </div>
    </div>
  );

  if (isLoading) {
    return renderEmptyState("Loading activities…", "Stitching together the latest events.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumbs items={[{ label: "Activity Log" }]} />
        <BackButton />
      </div>

      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-[1rem] w-[1rem] text-[#009688]" />
          <h1 className="text-[0.95rem] font-semibold text-[#5e5873]">Recent Activity</h1>
        </div>

        <div className="space-y-2">
          {!data || data.activities.length === 0
            ? renderEmptyState("No activities recorded yet", "Actions will appear here as your team works.")
            : data.activities.map((activity) => {
              const Icon = getActionIcon(activity.action);
              return (
                <div
                  key={activity._id}
                  className="flex items-start gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] p-3 text-[0.8rem] text-[#5e5873] shadow-sm"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[0.428rem] bg-[#e0f2f1] text-[#009688]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p>
                      <span className="font-semibold">{activity.userName}</span>{" "}
                      <span className="text-[#6e6b7b]">{activity.action.replace(/_/g, " ")}</span>
                    </p>
                    <p className="text-[#6e6b7b]">{activity.description}</p>
                    {activity.details?.count ? (
                      <p className="text-[0.75rem] text-[#b9b9c3]">{activity.details.count} items affected</p>
                    ) : null}
                    <p className="text-[0.75rem] text-[#b9b9c3]">{activity.timeAgo}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
