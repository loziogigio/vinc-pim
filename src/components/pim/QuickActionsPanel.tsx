"use client";

import Link from "next/link";
import { Upload, Settings, FileSearch, BarChart3 } from "lucide-react";

export function QuickActionsPanel() {
  const actions = [
    {
      icon: Upload,
      label: "Import Products",
      description: "Upload CSV or Excel file",
      href: "/b2b/pim/import",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: FileSearch,
      label: "Review Drafts",
      description: "Check products pending publish",
      href: "/b2b/pim/products?status=draft",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      icon: BarChart3,
      label: "Fix Low Quality",
      description: "Improve product completeness",
      href: "/b2b/pim/products?sort=score",
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      icon: Settings,
      label: "Manage Sources",
      description: "Configure import sources",
      href: "/b2b/pim/sources",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <Settings className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Quick Actions</h2>
      </div>

      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-2.5 rounded border border-border hover:bg-accent transition"
            >
              <div className={`${action.bgColor} ${action.color} p-2 rounded`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-xs text-muted-foreground">{action.description}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
