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
  { previewBg: string; previewText: string; previewBorder?: string }
> = {
  "hero-full-width": {
    previewBg: "bg-gradient-to-r from-[#11998e] to-[#38ef7d]",
    previewText: "text-white"
  },
  "hero-split": {
    previewBg: "bg-gradient-to-r from-[#667eea] to-[#764ba2]",
    previewText: "text-white"
  },
  "hero-carousel": {
    previewBg: "bg-gradient-to-r from-[#4facfe] to-[#00f2fe]",
    previewText: "text-white"
  },
  "product-slider": {
    previewBg: "bg-[#fafafc]",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-[#ebe9f1]"
  },
  "product-grid": {
    previewBg: "bg-[#fafafc]",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-[#ebe9f1]"
  },
  "category-grid": {
    previewBg: "bg-[#fafafc]",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-[#ebe9f1]"
  },
  "category-carousel": {
    previewBg: "bg-[#fafafc]",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-[#ebe9f1]"
  },
  "content-features": {
    previewBg: "bg-white",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-dashed border-[#d8d6de]"
  },
  "content-rich-text": {
    previewBg: "bg-white",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-dashed border-[#d8d6de]"
  },
  "content-testimonials": {
    previewBg: "bg-white",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-dashed border-[#d8d6de]"
  }
};

const defaultStyle = {
  previewBg: "bg-[#fafafc]",
  previewText: "text-[#5e5873]",
  previewBorder: "border border-[#ebe9f1]"
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
        "group relative cursor-pointer overflow-visible rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]/40",
        selectedBlockId === block.id
          ? "border-[2px] border-[#009688] p-[calc(1rem-1px)] shadow-[0_4px_16px_rgba(0,150,136,0.15)]"
          : "hover:-translate-y-0.5 hover:border-[#009688] hover:shadow-[0_4px_12px_rgba(0,150,136,0.1)]"
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
      {/* Position Badge */}
      <div className="absolute left-4 top-[-10px] z-20 rounded-[12px] bg-[#5e5873] px-[10px] py-[3px] text-[11px] font-semibold text-white shadow-sm">
        Position {index + 1}
      </div>

      {/* Action Buttons */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-[0.428rem] bg-white/95 px-1 py-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-[4px] text-[#6e6b7b] transition hover:bg-[#f5f5f5]"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            selectBlock(block.id);
            onOpenSettings();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6e6b7b] transition hover:bg-[rgba(0,150,136,0.1)] hover:text-[#009688]"
          aria-label="Configure block"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            duplicateBlock(block.id);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6e6b7b] transition hover:bg-[#f5f5f5]"
          aria-label="Duplicate block"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            removeBlock(block.id);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-red-600 transition hover:bg-red-50"
          aria-label="Remove block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Block Content */}
      <div className="space-y-[0.75rem]">
        <div className="space-y-[0.15rem]">
          <h3 className="text-[0.95rem] font-semibold text-[#5e5873]">
            {template?.label ?? block.type}
          </h3>
          <p className="text-[0.75rem] text-[#b9b9c3]">Block {index + 1}</p>
        </div>
        <div
          className={cn(
            "rounded-[0.428rem] px-3 py-3 text-center text-[0.85rem] font-medium transition-all",
            styleTokens.previewBg,
            styleTokens.previewText,
            styleTokens.previewBorder
          )}
        >
          {template?.label ?? block.type} Preview
        </div>
      </div>
    </div>
  );
};
