"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { CatalogOverviewCards } from "@/components/b2b/CatalogOverviewCards";
import { NeedsAttentionPanel } from "@/components/b2b/NeedsAttentionPanel";
import { RecentActivityPanel } from "@/components/b2b/RecentActivityPanel";
import { QuickSearchSection } from "@/components/b2b/QuickSearchSection";
import { QuickActionsSection } from "@/components/b2b/QuickActionsSection";
import type { CatalogOverview, ActivityLog } from "@/lib/types/b2b";

type DashboardData = {
  overview: CatalogOverview;
  activities: Array<ActivityLog & { timeAgo: string }>;
};

export default function B2BDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch("/api/b2b/dashboard");
        if (!res.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const dashboardData = await res.json();
        setData(dashboardData);
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const handleSearch = (query: string, filter?: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter) params.set("filter", filter);
    router.push(`/b2b/catalog?${params.toString()}`);
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
    return renderEmptyState("Loading dashboard…", "Gathering catalog insights and activity.");
  }

  if (!data) {
    return renderEmptyState("Unable to load dashboard", "Please refresh the page to try again.");
  }

  const needsAttentionItems = [
    {
      icon: "sync" as const,
      count: 2847,
      label: "synced from ERP",
      action: "Review changes",
      href: "/b2b/catalog?filter=recent_sync",
    },
    {
      icon: "enhance" as const,
      count: data.overview.missingMarketing,
      label: "missing marketing",
      action: "Bulk enhance",
      href: "/b2b/catalog?action=enhance",
    },
    {
      icon: "image" as const,
      count: data.overview.missingImages,
      label: "missing images",
      action: "Check supplier",
      href: "/b2b/catalog?filter=missing_images",
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Home" }]} />

      <CatalogOverviewCards overview={data.overview} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <NeedsAttentionPanel items={needsAttentionItems} />
        <RecentActivityPanel activities={data.activities} />
      </div>

      <QuickSearchSection onSearch={handleSearch} />

      <QuickActionsSection />
    </div>
  );
}
