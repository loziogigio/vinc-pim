"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  badge?: string;
  exactMatch?: boolean;
}

/**
 * Reusable navigation link with active state detection
 * Handles tenant-prefixed URLs automatically
 */
export function NavLink({
  href,
  icon: Icon,
  label,
  disabled,
  badge,
  exactMatch = false,
}: NavLinkProps) {
  const pathname = usePathname() || "";

  // Extract tenant prefix from current pathname (e.g., /tenant-id/b2b/... -> /tenant-id)
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const fullHref = `${tenantPrefix}${href}`;

  // Determine if this link is active
  const isActive = exactMatch
    ? pathname === fullHref
    : pathname === fullHref || pathname.startsWith(`${fullHref}/`);

  if (disabled) {
    return (
      <span
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
          "text-muted-foreground/50 cursor-not-allowed"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge && (
          <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </span>
    );
  }

  return (
    <Link
      href={fullHref}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        isActive
          ? "bg-[#009688]/10 text-[#009688] font-medium"
          : "text-[#6e6b7b] hover:bg-[#f8f8f8] hover:text-[#5e5873]"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </Link>
  );
}
