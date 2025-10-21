"use client";

import Link from "next/link";
import { Sparkles, Grid, Settings, FileText, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    label: "Bulk AI Enhance",
    icon: Sparkles,
    href: "/b2b/catalog?action=enhance",
    variant: "default" as const,
  },
  {
    label: "Product Page Builder",
    icon: Paintbrush,
    href: "/b2b/product-builder",
    variant: "outline" as const,
  },
  {
    label: "View All Products",
    icon: Grid,
    href: "/b2b/catalog",
    variant: "outline" as const,
  },
  {
    label: "Mapping Config",
    icon: Settings,
    href: "/b2b/settings",
    variant: "outline" as const,
  },
  {
    label: "Activity Log",
    icon: FileText,
    href: "/b2b/activity",
    variant: "outline" as const,
  },
];

export function QuickActionsSection() {
  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <Settings className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Quick Actions</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <Button
                variant={action.variant}
                className="h-auto w-full justify-start gap-1.5 px-3 py-2 text-xs"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{action.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
