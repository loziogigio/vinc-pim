"use client";

import { useMemo } from "react";
import {
  Layout,
  LayoutDashboard,
  Layers,
  Rows,
  SquareStack,
  SquareKanban,
  Sparkles,
  Type,
  Quote
} from "lucide-react";
import { BLOCK_REGISTRY } from "@/lib/config/blockTemplates";
import { usePageBuilderStore } from "@/lib/store/pageBuilderStore";

type LibraryEntry = {
  id: string;
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
};

const COLOR_MAP: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  "hero-full-width": { bg: "bg-orange-100", text: "text-orange-600", icon: LayoutDashboard },
  "hero-split": { bg: "bg-purple-100", text: "text-purple-600", icon: Layout },
  "hero-carousel": { bg: "bg-pink-100", text: "text-pink-600", icon: Layers },
  "product-slider": { bg: "bg-blue-100", text: "text-blue-600", icon: Rows },
  "product-grid": { bg: "bg-cyan-100", text: "text-cyan-600", icon: SquareStack },
  "category-grid": { bg: "bg-emerald-100", text: "text-emerald-600", icon: SquareKanban },
  "content-features": { bg: "bg-yellow-100", text: "text-yellow-600", icon: Sparkles },
  "content-rich-text": { bg: "bg-slate-100", text: "text-slate-600", icon: Type },
  "content-testimonials": { bg: "bg-indigo-100", text: "text-indigo-600", icon: Quote }
};

const buildLibraryEntries = (): LibraryEntry[] =>
  Object.values(BLOCK_REGISTRY).flatMap((family) =>
    Object.values(family.variants).map((variant) => {
      const colors = COLOR_MAP[variant.id] ?? {
        bg: "bg-slate-100",
        text: "text-slate-600",
        icon: Layout
      };
      return {
        id: variant.id,
        label: variant.label,
        bg: colors.bg,
        text: colors.text,
        icon: colors.icon
      };
    })
  );

export const BlockLibrary = () => {
  const addBlock = usePageBuilderStore((state) => state.addBlock);

  const entries = useMemo(() => buildLibraryEntries(), []);

  return (
    <nav className="flex h-full w-full flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Blocks</div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => addBlock(entry.id)}
              className={`${entry.bg} ${entry.text} group flex w-full flex-col items-center rounded-lg px-2 py-4 text-center shadow-sm transition-transform hover:scale-105`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-current">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-2 text-xs font-medium text-current">{entry.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
