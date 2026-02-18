"use client";

/* eslint-disable @next/next/no-img-element */
import { FolderOpen } from "lucide-react";
import type { MobileCategorySliderBlock, CachedCategory } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileCategorySliderPreviewProps {
  block: MobileCategorySliderBlock;
  primaryColor?: string;
}

const SAMPLE_CATEGORIES: CachedCategory[] = [
  { category_id: "1", name: "Category 1", slug: "cat-1", product_count: 24 },
  { category_id: "2", name: "Category 2", slug: "cat-2", product_count: 18 },
  { category_id: "3", name: "Category 3", slug: "cat-3", product_count: 32 },
  { category_id: "4", name: "Category 4", slug: "cat-4", product_count: 15 },
  { category_id: "5", name: "Category 5", slug: "cat-5", product_count: 41 },
];

const PLACEHOLDER_COLORS = [
  "bg-gradient-to-br from-teal-100 to-teal-200",
  "bg-gradient-to-br from-indigo-100 to-indigo-200",
  "bg-gradient-to-br from-rose-100 to-rose-200",
  "bg-gradient-to-br from-orange-100 to-orange-200",
  "bg-gradient-to-br from-cyan-100 to-cyan-200",
];

export function MobileCategorySliderPreview({ block, primaryColor = "#ec4899" }: MobileCategorySliderPreviewProps) {
  const { title, show_title, items_visible, show_product_count } = block.settings;

  const categories = block._cached_categories?.length ? block._cached_categories : SAMPLE_CATEGORIES;
  const hasRealCategories = Boolean(block._cached_categories?.length);
  const cardWidth = items_visible === 1 ? "w-[180px]" : items_visible === 2 ? "w-[140px]" : "w-[100px]";

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
        {categories.map((cat, index) => (
          <div
            key={cat.category_id}
            className={cn(
              "flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 shadow-sm snap-start",
              cardWidth
            )}
          >
            <div
              className={cn(
                "relative flex aspect-square items-center justify-center",
                !cat.hero_image_url && PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
              )}
            >
              {cat.hero_image_url ? (
                <img src={cat.hero_image_url} alt={cat.name} className="h-full w-full object-cover" />
              ) : (
                <FolderOpen className="h-8 w-8 text-gray-400" />
              )}
              {/* Name overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6">
                <p className="truncate text-xs font-semibold text-white">{cat.name}</p>
                {show_product_count && (
                  <p className="text-[10px] text-white/80">{cat.product_count} products</p>
                )}
              </div>
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
