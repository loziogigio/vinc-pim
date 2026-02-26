"use client";

/* eslint-disable @next/next/no-img-element */
import { Tag } from "lucide-react";
import type { MobileEntitySliderBlock, CachedEntity } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileEntitySliderPreviewProps {
  block: MobileEntitySliderBlock;
  primaryColor?: string;
}

const SAMPLE_ENTITIES: CachedEntity[] = [
  { id: "1", name: "Brand A", slug: "brand-a", product_count: 24, filter_value: "brand-a" },
  { id: "2", name: "Brand B", slug: "brand-b", product_count: 18, filter_value: "brand-b" },
  { id: "3", name: "Brand C", slug: "brand-c", product_count: 32, filter_value: "brand-c" },
  { id: "4", name: "Brand D", slug: "brand-d", product_count: 15, filter_value: "brand-d" },
  { id: "5", name: "Brand E", slug: "brand-e", product_count: 41, filter_value: "brand-e" },
];

const PLACEHOLDER_COLORS = [
  "bg-gradient-to-br from-violet-100 to-violet-200",
  "bg-gradient-to-br from-sky-100 to-sky-200",
  "bg-gradient-to-br from-lime-100 to-lime-200",
  "bg-gradient-to-br from-fuchsia-100 to-fuchsia-200",
  "bg-gradient-to-br from-amber-100 to-amber-200",
];

export function MobileEntitySliderPreview({
  block,
  primaryColor = "#ec4899",
}: MobileEntitySliderPreviewProps) {
  const { title, show_title, items_visible, show_product_count } = block.settings;

  const MAX_PREVIEW = 20;
  const allEntities = block._cached_entities?.length ? block._cached_entities : SAMPLE_ENTITIES;
  const entities = allEntities.slice(0, MAX_PREVIEW);
  const hasRealEntities = Boolean(block._cached_entities?.length);
  const cardWidth =
    items_visible === 1 ? "w-[180px]" : items_visible === 2 ? "w-[140px]" : "w-[100px]";

  return (
    <div className="bg-white py-4">
      {show_title && title && (
        <div className="mb-3 flex items-center justify-between px-4">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button type="button" className="text-xs" style={{ color: primaryColor }}>
            See All
          </button>
        </div>
      )}

      <div
        className="flex gap-3 overflow-x-scroll px-4 pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {entities.map((entity, index) => (
          <div
            key={entity.id}
            className={cn(
              "flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 shadow-sm snap-start",
              cardWidth
            )}
          >
            <div
              className={cn(
                "relative flex aspect-square items-center justify-center",
                !entity.image_url && PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
              )}
            >
              {entity.image_url ? (
                <img src={entity.image_url} alt={entity.name} className="h-full w-full object-contain p-1" />
              ) : (
                <Tag className="h-8 w-8 text-gray-400" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6">
                <p className="truncate text-xs font-semibold text-white">{entity.name}</p>
                {show_product_count && (
                  <p className="text-[10px] text-white/80">{entity.product_count} products</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!hasRealEntities && (
        <p className="mt-2 px-4 text-[10px] text-gray-400 text-center">
          Sample entities &bull; Select entity source in settings
        </p>
      )}
    </div>
  );
}
