"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavSectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

/**
 * Collapsible navigation section
 * Groups related nav items under a header
 */
export function NavSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  collapsible = true,
}: NavSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#b9b9c3]">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span>{title}</span>
        </div>
        <div className="mt-1 space-y-0.5">{children}</div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
          "text-[#b9b9c3] hover:text-[#6e6b7b] transition-colors"
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="flex-1 text-left">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>
      {isOpen && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}
