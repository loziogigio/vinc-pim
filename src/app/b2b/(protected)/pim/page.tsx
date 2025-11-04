"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { PIMOverviewCards } from "@/components/pim/PIMOverviewCards";
import { PriorityProductList } from "@/components/pim/PriorityProductList";
import { RecentImportsPanel } from "@/components/pim/RecentImportsPanel";
import { QuickActionsPanel } from "@/components/pim/QuickActionsPanel";

type DashboardStats = {
  total_products: number;
  published_count: number;
  draft_count: number;
  critical_issues_count: number;
  avg_completeness_score: number;
  auto_published_today: number;
  pending_imports: number;
};

export default function PIMDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch("/api/b2b/pim/stats");
        if (!res.ok) {
          throw new Error("Failed to fetch PIM stats");
        }
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error("PIM dashboard fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const renderEmptyState = (message: string, sub?: string) => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <p className="text-[1.05rem] font-semibold">{message}</p>
        {sub ? <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{sub}</p> : null}
      </div>
    </div>
  );

  if (isLoading) {
    return renderEmptyState("Loading PIM dashboard…", "Gathering product insights and quality scores.");
  }

  if (!stats) {
    return renderEmptyState("Unable to load dashboard", "Please refresh the page to try again.");
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Product Information Management" }]} />

      <PIMOverviewCards stats={stats} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <RecentImportsPanel />
        <QuickActionsPanel />
      </div>

      <PriorityProductList />
    </div>
  );
}
