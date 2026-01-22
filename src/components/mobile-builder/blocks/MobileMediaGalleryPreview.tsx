"use client";

import { Image as ImageIcon } from "lucide-react";
import type { MobileMediaGalleryBlock } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileMediaGalleryPreviewProps {
  block: MobileMediaGalleryBlock;
}

// Sample items for preview
const SAMPLE_ITEMS = [
  { title: "Category 1", color: "bg-gradient-to-br from-rose-400 to-rose-500" },
  { title: "Category 2", color: "bg-gradient-to-br from-violet-400 to-violet-500" },
  { title: "Category 3", color: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "Category 4", color: "bg-gradient-to-br from-amber-400 to-amber-500" },
  { title: "Category 5", color: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "Category 6", color: "bg-gradient-to-br from-fuchsia-400 to-fuchsia-500" },
];

const GAP_SIZES = {
  none: "gap-0",
  sm: "gap-1",
  md: "gap-2",
};

const ASPECT_RATIO_CLASS = {
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-video",
};

export function MobileMediaGalleryPreview({ block }: MobileMediaGalleryPreviewProps) {
  const { columns, gap, aspect_ratio } = block.settings;

  const items = block.items.length > 0
    ? block.items
    : SAMPLE_ITEMS.map((s, i) => ({
        media_url: "",
        media_type: "image" as const,
        title: s.title,
        _sample: s,
      }));

  const gridCols = columns === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="bg-white p-4">
      <div className={cn("grid", gridCols, GAP_SIZES[gap])}>
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "relative overflow-hidden rounded-lg",
              ASPECT_RATIO_CLASS[aspect_ratio]
            )}
          >
            {item.media_url ? (
              <img
                src={item.media_url}
                alt={item.title || `Item ${index + 1}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  (item as any)._sample?.color || "bg-gray-200"
                )}
              >
                <ImageIcon className="h-6 w-6 text-white/50" />
              </div>
            )}

            {/* Title overlay */}
            {item.title && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-center text-[10px] font-medium text-white">
                  {item.title}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
