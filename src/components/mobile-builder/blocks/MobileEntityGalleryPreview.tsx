"use client";

/* eslint-disable @next/next/no-img-element */
import { Tag } from "lucide-react";
import type { MobileEntityGalleryBlock, CachedEntity } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileEntityGalleryPreviewProps {
  block: MobileEntityGalleryBlock;
  primaryColor?: string;
}

const SAMPLE_ENTITIES: CachedEntity[] = [
  { id: "1", name: "Entity 1", slug: "entity-1", product_count: 24, filter_value: "e1" },
  { id: "2", name: "Entity 2", slug: "entity-2", product_count: 18, filter_value: "e2" },
  { id: "3", name: "Entity 3", slug: "entity-3", product_count: 32, filter_value: "e3" },
  { id: "4", name: "Entity 4", slug: "entity-4", product_count: 15, filter_value: "e4" },
];

const PLACEHOLDER_COLORS = [
  "bg-gradient-to-br from-violet-100 to-violet-200",
  "bg-gradient-to-br from-sky-100 to-sky-200",
  "bg-gradient-to-br from-lime-100 to-lime-200",
  "bg-gradient-to-br from-fuchsia-100 to-fuchsia-200",
];

export function MobileEntityGalleryPreview({ block, primaryColor }: MobileEntityGalleryPreviewProps) {
  const { title, show_title, columns, gap, show_product_count } = block.settings;

  const MAX_PREVIEW = 12;
  const allEntities = block._cached_entities?.length ? block._cached_entities : SAMPLE_ENTITIES;
  const entities = allEntities.slice(0, MAX_PREVIEW);
  const hasRealEntities = Boolean(block._cached_entities?.length);
  const hasMore = allEntities.length > MAX_PREVIEW;
  const gridCols = columns === 3 ? "grid-cols-3" : "grid-cols-2";
  const gapClass = gap === "none" ? "gap-0" : gap === "sm" ? "gap-1.5" : "gap-3";

  return (
    <div className="bg-white py-4">
      {show_title && title && (
        <div className="mb-3 px-4">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
      )}

      <div className={cn("grid px-4", gridCols, gapClass)}>
        {entities.map((entity, index) => (
          <div
            key={entity.id}
            className="relative overflow-hidden rounded-lg border border-gray-100 shadow-sm"
          >
            <div
              className={cn(
                "flex aspect-square items-center justify-center",
                !entity.image_url && PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
              )}
            >
              {entity.image_url ? (
                <img src={entity.image_url} alt={entity.name} className="h-full w-full object-contain p-1" />
              ) : (
                <Tag className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6">
              <p className="truncate text-xs font-semibold text-white">{entity.name}</p>
              {show_product_count && (
                <p className="text-[10px] text-white/80">{entity.product_count} products</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <p className="mt-2 px-4 text-[10px] text-gray-400 text-center">
          Showing {MAX_PREVIEW} of {allEntities.length} &bull; Mobile app loads all
        </p>
      )}

      {!hasRealEntities && (
        <p className="mt-2 px-4 text-[10px] text-gray-400 text-center">
          Sample entities &bull; Select entity source in settings
        </p>
      )}
    </div>
  );
}
