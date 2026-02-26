"use client";

/* eslint-disable @next/next/no-img-element */
import { FolderOpen } from "lucide-react";
import type { MobileCategoryGalleryBlock, CachedCategory } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileCategoryGalleryPreviewProps {
  block: MobileCategoryGalleryBlock;
  primaryColor?: string;
}

const SAMPLE_CATEGORIES: CachedCategory[] = [
  { category_id: "1", name: "Category 1", slug: "cat-1", product_count: 24 },
  { category_id: "2", name: "Category 2", slug: "cat-2", product_count: 18 },
  { category_id: "3", name: "Category 3", slug: "cat-3", product_count: 32 },
  { category_id: "4", name: "Category 4", slug: "cat-4", product_count: 15 },
];

const PLACEHOLDER_COLORS = [
  "bg-gradient-to-br from-teal-100 to-teal-200",
  "bg-gradient-to-br from-indigo-100 to-indigo-200",
  "bg-gradient-to-br from-rose-100 to-rose-200",
  "bg-gradient-to-br from-orange-100 to-orange-200",
];

export function MobileCategoryGalleryPreview({ block, primaryColor }: MobileCategoryGalleryPreviewProps) {
  const { title, show_title, columns, gap, show_product_count } = block.settings;

  const categories = block._cached_categories?.length ? block._cached_categories : SAMPLE_CATEGORIES;
  const hasRealCategories = Boolean(block._cached_categories?.length);

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
        {categories.map((cat, index) => (
          <div
            key={cat.category_id}
            className="relative overflow-hidden rounded-lg border border-gray-100 shadow-sm"
          >
            <div
              className={cn(
                "flex aspect-square items-center justify-center",
                !cat.hero_image_url && PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
              )}
            >
              {cat.hero_image_url ? (
                <img src={cat.hero_image_url} alt={cat.name} className="h-full w-full object-cover" />
              ) : (
                <FolderOpen className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6">
              <p className="truncate text-xs font-semibold text-white">{cat.name}</p>
              {show_product_count && (
                <p className="text-[10px] text-white/80">{cat.product_count} products</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!hasRealCategories && (
        <p className="mt-2 px-4 text-[10px] text-gray-400 text-center">
          Sample categories • Select categories in settings
        </p>
      )}
    </div>
  );
}
