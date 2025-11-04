"use client";

import { Package, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";

type PIMOverviewCardsProps = {
  stats: {
    total_products: number;
    published_count: number;
    draft_count: number;
    critical_issues_count: number;
    avg_completeness_score: number;
  };
};

export function PIMOverviewCards({ stats }: PIMOverviewCardsProps) {
  const publishedPercentage = stats.total_products > 0
    ? ((stats.published_count / stats.total_products) * 100).toFixed(1)
    : "0.0";

  const issuesPercentage = stats.total_products > 0
    ? ((stats.critical_issues_count / stats.total_products) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Product Quality Overview</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-0.5">
          <p className="text-2xl font-bold">{stats.total_products.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Products</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-emerald-600">{stats.published_count.toLocaleString()}</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xs text-muted-foreground">Published ({publishedPercentage}%)</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-amber-600">{stats.critical_issues_count.toLocaleString()}</p>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xs text-muted-foreground">Critical Issues ({issuesPercentage}%)</p>
        </div>

        <div className="space-y-0.5">
          <p className="text-2xl font-bold text-blue-600">{stats.avg_completeness_score}%</p>
          <p className="text-xs text-muted-foreground">Avg. Completeness</p>
        </div>
      </div>
    </div>
  );
}
