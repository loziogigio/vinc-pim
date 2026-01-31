"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

/**
 * Extract tenant prefix from pathname if present
 * e.g., "/dfl-eventi-it/b2b/notifications" -> "/dfl-eventi-it"
 * e.g., "/b2b/notifications" -> ""
 */
function getTenantPrefix(pathname: string): string {
  // Check if path starts with a tenant prefix (not /b2b directly)
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && segments[0] !== "b2b" && segments[1] === "b2b") {
    return `/${segments[0]}`;
  }
  return "";
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const pathname = usePathname();
  const tenantPrefix = getTenantPrefix(pathname);

  // Helper to prepend tenant prefix to href
  const withTenant = (href: string) => `${tenantPrefix}${href}`;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-0.5 text-xs">
        <li>
          <Link
            href={withTenant("/b2b/dashboard")}
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
                href={withTenant(item.href)}
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
