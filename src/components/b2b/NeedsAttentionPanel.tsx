"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw, Sparkles, Image, ChevronRight } from "lucide-react";

type AttentionItem = {
  icon: "sync" | "enhance" | "image";
  count: number;
  label: string;
  action: string;
  href: string;
};

type NeedsAttentionPanelProps = {
  items: AttentionItem[];
};

const iconMap = {
  sync: RefreshCw,
  enhance: Sparkles,
  image: Image,
};

export function NeedsAttentionPanel({ items }: NeedsAttentionPanelProps) {
  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">Needs Attention</h2>
      </div>

      <div className="space-y-1.5">
        {items.map((item, index) => {
          const Icon = iconMap[item.icon];
          return (
            <Link
              key={index}
              href={item.href}
              className="group block rounded-lg bg-muted/30 p-2 transition hover:bg-muted/50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {item.count.toLocaleString()} products
                    </p>
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-primary">
                      → {item.action}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
