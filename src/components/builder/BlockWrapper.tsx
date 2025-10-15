"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Copy, GripVertical, Settings, Trash2 } from "lucide-react";
import { usePageBuilderStore } from "@/lib/store/pageBuilderStore";
import { getBlockTemplate } from "@/lib/config/blockTemplates";
import type { PageBlock } from "@/lib/types/blocks";
import { cn } from "@/components/ui/utils";

interface BlockWrapperProps {
  block: PageBlock;
  index: number;
  onOpenSettings: () => void;
}

const builderStyles: Record<
  string,
  { background: string; text: string; accent: string; badgeBg: string }
> = {
  "hero-full-width": {
    background: "bg-gradient-to-br from-blue-500 to-purple-600 text-white",
    text: "text-white",
    accent: "hover:bg-blue-600",
    badgeBg: "bg-white/20 text-white"
  },
  "hero-split": {
    background: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
    text: "text-white",
    accent: "hover:bg-purple-600",
    badgeBg: "bg-white/20 text-white"
  },
  "hero-carousel": {
    background: "bg-gradient-to-br from-rose-500 to-amber-500 text-white",
    text: "text-white",
    accent: "hover:bg-rose-600",
    badgeBg: "bg-white/20 text-white"
  },
  "product-slider": {
    background: "bg-white text-slate-800 border border-slate-200",
    text: "text-slate-800",
    accent: "hover:bg-slate-100",
    badgeBg: "bg-slate-900 text-white"
  },
  "product-grid": {
    background: "bg-white text-slate-800 border border-slate-200",
    text: "text-slate-800",
    accent: "hover:bg-slate-100",
    badgeBg: "bg-slate-900 text-white"
  },
  "category-grid": {
    background: "bg-slate-100 text-slate-800",
    text: "text-slate-800",
    accent: "hover:bg-slate-200",
    badgeBg: "bg-slate-900 text-white"
  },
  "content-features": {
    background: "bg-blue-50 text-blue-900",
    text: "text-blue-900",
    accent: "hover:bg-blue-100",
    badgeBg: "bg-blue-600 text-white"
  },
  "content-rich-text": {
    background: "bg-slate-50 text-slate-800",
    text: "text-slate-800",
    accent: "hover:bg-slate-100",
    badgeBg: "bg-slate-900 text-white"
  },
  "content-testimonials": {
    background: "bg-indigo-50 text-indigo-900",
    text: "text-indigo-900",
    accent: "hover:bg-indigo-100",
    badgeBg: "bg-indigo-600 text-white"
  }
};

const defaultStyle = {
  background: "bg-white text-slate-800 border border-slate-200",
  text: "text-slate-800",
  accent: "hover:bg-slate-100",
  badgeBg: "bg-slate-900 text-white"
};

export const BlockWrapper = ({ block, index, onOpenSettings }: BlockWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id
  });
  const selectBlock = usePageBuilderStore((state) => state.selectBlock);
  const removeBlock = usePageBuilderStore((state) => state.removeBlock);
  const duplicateBlock = usePageBuilderStore((state) => state.duplicateBlock);
  const selectedBlockId = usePageBuilderStore((state) => state.selectedBlockId);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  const template = getBlockTemplate(block.type);
  const styleTokens = builderStyles[block.type] ?? defaultStyle;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-transparent shadow-sm transition-all",
        styleTokens.background,
        selectedBlockId === block.id ? "ring-2 ring-orange-400" : "hover:ring-2 hover:ring-slate-300"
      )}
      role="button"
      tabIndex={0}
      onClick={() => selectBlock(block.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          selectBlock(block.id);
        }
      }}
    >
      <div
        className={cn(
          "absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-sm",
          styleTokens.badgeBg
        )}
      >
        Position {index + 1}
      </div>

      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-1 py-1 opacity-0 shadow-lg transition group-hover:opacity-100">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            selectBlock(block.id);
            onOpenSettings();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-600"
          aria-label="Configure block"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            duplicateBlock(block.id);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          aria-label="Duplicate block"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            removeBlock(block.id);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
          aria-label="Remove block"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-[180px] flex-col items-center justify-center px-10 py-12 text-center">
        <h3 className={cn("text-lg font-semibold", styleTokens.text)}>
          {template?.label ?? block.type}
        </h3>
        <p className={cn("mt-2 text-sm opacity-90", styleTokens.text)}>Block {index + 1}</p>
      </div>
    </div>
  );
};
