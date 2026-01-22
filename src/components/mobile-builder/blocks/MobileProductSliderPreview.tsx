"use client";

/* eslint-disable @next/next/no-img-element */
import { ShoppingCart, Package } from "lucide-react";
import type { MobileProductSliderBlock, CachedProduct } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileProductSliderPreviewProps {
  block: MobileProductSliderBlock;
  primaryColor?: string;
}

// Sample products for preview (fallback)
const SAMPLE_PRODUCTS: CachedProduct[] = [
  { entity_code: "1", sku: "PROD-001", name: "Product 1", price: 29.99 },
  { entity_code: "2", sku: "PROD-002", name: "Product 2", price: 49.99 },
  { entity_code: "3", sku: "PROD-003", name: "Product 3", price: 19.99 },
  { entity_code: "4", sku: "PROD-004", name: "Product 4", price: 39.99 },
  { entity_code: "5", sku: "PROD-005", name: "Product 5", price: 59.99 },
];

const PLACEHOLDER_COLORS = [
  "bg-gradient-to-br from-emerald-100 to-emerald-200",
  "bg-gradient-to-br from-blue-100 to-blue-200",
  "bg-gradient-to-br from-purple-100 to-purple-200",
  "bg-gradient-to-br from-amber-100 to-amber-200",
  "bg-gradient-to-br from-pink-100 to-pink-200",
];

export function MobileProductSliderPreview({ block, primaryColor = "#ec4899" }: MobileProductSliderPreviewProps) {
  const {
    title,
    show_title,
    items_visible,
    show_price,
    show_add_to_cart,
  } = block.settings;

  // Use real products if available, otherwise sample
  const products = block._cached_products?.length ? block._cached_products : SAMPLE_PRODUCTS;
  const hasRealProducts = Boolean(block._cached_products?.length);
  // Fixed pixel widths for proper horizontal scrolling
  const cardWidth = items_visible === 2 ? "w-[140px]" : "w-[100px]";

  return (
    <div className="bg-white py-4">
      {/* Title */}
      {show_title && title && (
        <div className="mb-3 flex items-center justify-between px-4">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button type="button" className="text-xs" style={{ color: primaryColor }}>
            See All
          </button>
        </div>
      )}

      {/* Horizontal scroll - use fixed widths to enable scrolling */}
      <div
        className="flex gap-3 overflow-x-scroll px-4 pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {products.map((product, index) => (
          <div
            key={product.entity_code}
            className={cn(
              "flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm snap-start",
              cardWidth
            )}
          >
            {/* Product image */}
            <div
              className={cn(
                "flex aspect-square items-center justify-center",
                !product.cover_image_url && PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
              )}
            >
              {product.cover_image_url ? (
                <img
                  src={product.cover_image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-8 w-8 text-gray-400" />
              )}
            </div>

            {/* Product info */}
            <div className="p-2">
              <p className="truncate text-xs font-medium text-gray-700">
                {product.name || product.sku}
              </p>
              {show_price && product.price !== undefined && (
                <p className="text-sm font-bold text-gray-900">
                  €{product.price.toFixed(2)}
                </p>
              )}
              {show_add_to_cart && (
                <button
                  type="button"
                  className="mt-1.5 flex w-full items-center justify-center gap-1 rounded py-1 text-[10px] font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShoppingCart className="h-3 w-3" />
                  Add
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Indicator for sample vs real data */}
      {!hasRealProducts && (
        <p className="mt-2 px-4 text-[10px] text-gray-400 text-center">
          Sample products • Configure search to load real products
        </p>
      )}
    </div>
  );
}
