"use client";

import { Package, Sparkles, AlertCircle } from "lucide-react";
import type { CatalogOverview } from "@/lib/types/b2b";

type CatalogOverviewCardsProps = {
  overview: CatalogOverview;
};

export function CatalogOverviewCards({ overview }: CatalogOverviewCardsProps) {
  const enhancedPercentage = overview.totalProducts > 0
    ? ((overview.enhancedProducts / overview.totalProducts) * 100).toFixed(1)
    : "0.0";

  const needsAttentionPercentage = overview.totalProducts > 0
    ? ((overview.needsAttention / overview.totalProducts) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <Package className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Catalog Overview</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-0.5">
          <p className="text-2xl font-bold">{overview.totalProducts.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Products</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-emerald-600">{overview.enhancedProducts.toLocaleString()}</p>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xs text-muted-foreground">Enhanced ({enhancedPercentage}%)</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-amber-600">{overview.needsAttention.toLocaleString()}</p>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xs text-muted-foreground">Need Attention ({needsAttentionPercentage}%)</p>
        </div>
      </div>
    </div>
  );
}
