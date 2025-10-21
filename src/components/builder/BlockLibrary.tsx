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
  Quote,
  Youtube,
  Image
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
  "content-testimonials": { bg: "bg-indigo-100", text: "text-indigo-600", icon: Quote },
  "youtubeEmbed": { bg: "bg-red-100", text: "text-red-600", icon: Youtube },
  "media-image": { bg: "bg-teal-100", text: "text-teal-600", icon: Image }
};

const buildLibraryEntries = (allowedBlockIds?: string[]): LibraryEntry[] => {
  const allEntries = Object.values(BLOCK_REGISTRY).flatMap((family) =>
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

  // If allowedBlockIds is provided, filter the entries
  if (allowedBlockIds && allowedBlockIds.length > 0) {
    return allEntries.filter((entry) => allowedBlockIds.includes(entry.id));
  }

  return allEntries;
};

interface BlockLibraryProps {
  /** Optional array of block IDs to show. If not provided, all blocks are shown. */
  allowedBlockIds?: string[];
}

export const BlockLibrary = ({ allowedBlockIds }: BlockLibraryProps = {}) => {
  const addBlock = usePageBuilderStore((state) => state.addBlock);

  const entries = useMemo(() => buildLibraryEntries(allowedBlockIds), [allowedBlockIds]);

  return (
    <nav className="flex h-full w-full flex-col overflow-hidden">
      <div className="px-2 py-4">
        <div className="text-[0.714rem] font-semibold uppercase tracking-[0.5px] text-[#b9b9c3]">Blocks</div>
      </div>
      <div className="flex-1 space-y-0 overflow-y-auto px-2 pb-4">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => addBlock(entry.id)}
              className="group flex w-full flex-col items-center gap-2 border-l-[3px] border-transparent px-2 py-3 text-center transition-all hover:border-l-[#009688] hover:bg-[rgba(0,150,136,0.08)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[0.428rem] bg-[#fafafc] text-[#5e5873] transition-all group-hover:bg-[rgba(0,150,136,0.12)] group-hover:text-[#009688]">
                <Icon className="h-[1.1rem] w-[1.1rem]" />
              </span>
              <span className="text-[0.7rem] leading-[1.2] text-[#b9b9c3]">{entry.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
