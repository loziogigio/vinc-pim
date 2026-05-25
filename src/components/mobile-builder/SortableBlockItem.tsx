"use client";

import { GripVertical, Trash2, Settings } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/components/ui/utils";
import type { MobileBlock } from "@/lib/types/mobile-builder";
import { MOBILE_BLOCK_LIBRARY } from "@/lib/types/mobile-builder";

interface SortableBlockItemProps {
  block: MobileBlock;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function SortableBlockItem({
  block,
  index,
  isSelected,
  onClick,
  onDelete,
}: SortableBlockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const blockMeta = MOBILE_BLOCK_LIBRARY.find((b) => b.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card p-3 transition-all",
        isDragging ? "opacity-50 shadow-lg" : "",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}
    >
      {/* Block number */}
      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
        {index + 1}
      </span>

      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <span className="text-sm font-medium text-foreground">
          {blockMeta?.name || block.type}
        </span>
      </button>

      <button
        type="button"
        onClick={onClick}
        className="p-1 text-muted-foreground hover:text-foreground"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
