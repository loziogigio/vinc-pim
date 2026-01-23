"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function AccordionItem({
  title,
  description,
  defaultOpen = false,
  children,
  badge,
  actions,
  className,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white overflow-hidden", className)}>
      <div className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-500 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{title}</span>
              {badge}
            </div>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      <div
        className={cn(
          "transition-all duration-200 ease-in-out overflow-hidden",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-slate-200 px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface AccordionGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionGroup({ children, className }: AccordionGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}
