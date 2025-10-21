"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-0.5 text-xs">
        <li>
          <Link
            href="/b2b/dashboard"
            className="flex items-center gap-1 text-muted-foreground transition hover:text-foreground"
          >
            <Home className="h-3 w-3" />
            <span className="font-medium">Dashboard</span>
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-0.5">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            {item.href ? (
              <Link
                href={item.href}
                className="font-medium text-muted-foreground transition hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
