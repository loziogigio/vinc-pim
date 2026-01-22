"use client";

/* eslint-disable @next/next/no-img-element */
import { ShoppingCart, Package } from "lucide-react";
import type { MobileProductGalleryBlock, CachedProduct } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileProductGalleryPreviewProps {
  block: MobileProductGalleryBlock;
  primaryColor?: string;
}

// Sample products for preview (fallback)
const SAMPLE_PRODUCTS: CachedProduct[] = [
  { entity_code: "1", sku: "PROD-001", name: "Premium Widget Pro", price: 129.99 },
  { entity_code: "2", sku: "PROD-002", name: "Smart Gadget X", price: 79.99 },
  { entity_code: "3", sku: "PROD-003", name: "Ultra Device Plus", price: 199.99 },
  { entity_code: "4", sku: "PROD-004", name: "Pro Tool Kit", price: 49.99 },
  { entity_code: "5", sku: "PROD-005", name: "Elite Component", price: 89.99 },
  { entity_code: "6", sku: "PROD-006", name: "Basic Accessory", price: 29.99 },
  { entity_code: "7", sku: "PROD-007", name: "Advanced Module", price: 149.99 },
  { entity_code: "8", sku: "PROD-008", name: "Standard Part", price: 19.99 },
];

const PLACEHOLDER_COLORS = [
  "bg-gradient-to-br from-slate-100 to-slate-200",
  "bg-gradient-to-br from-zinc-100 to-zinc-200",
  "bg-gradient-to-br from-stone-100 to-stone-200",
  "bg-gradient-to-br from-neutral-100 to-neutral-200",
  "bg-gradient-to-br from-gray-100 to-gray-200",
];

const GAP_SIZES = {
  sm: "gap-2",
  md: "gap-3",
};

export function MobileProductGalleryPreview({ block, primaryColor = "#ec4899" }: MobileProductGalleryPreviewProps) {
  const {
    title,
    show_title,
    columns,
    gap,
    show_price,
    show_add_to_cart,
    card_style,
  } = block.settings;

  // Use real products if available, otherwise sample
  const allProducts = block._cached_products?.length ? block._cached_products : SAMPLE_PRODUCTS;
  const products = allProducts.slice(0, block.limit || 12);
  const hasRealProducts = Boolean(block._cached_products?.length);

  const gridCols = columns === 2 ? "grid-cols-2" : "grid-cols-3";
  const isCompact = card_style === "compact";

  return (
    <div className="bg-white py-4">
      {/* Title */}
      {show_title && title && (
        <div className="mb-3 px-4">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
      )}

      {/* Product grid */}
      <div className={cn("grid px-4", gridCols, GAP_SIZES[gap])}>
        {products.map((product, index) => (
          <div
            key={product.entity_code}
            className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm"
          >
            {/* Product image */}
            <div
              className={cn(
                "flex items-center justify-center",
                isCompact ? "aspect-square" : "aspect-[4/3]",
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
            <div className={cn("p-2", !isCompact && "p-3")}>
              <p
                className={cn(
                  "font-medium text-gray-700",
                  isCompact ? "truncate text-[10px]" : "line-clamp-2 text-xs"
                )}
              >
                {product.name || product.sku}
              </p>

              {show_price && product.price !== undefined && (
                <div className={cn("mt-1", !isCompact && "mt-2")}>
                  <span
                    className={cn(
                      "font-bold text-gray-900",
                      isCompact ? "text-xs" : "text-sm"
                    )}
                  >
                    €{product.price.toFixed(2)}
                  </span>
                </div>
              )}

              {show_add_to_cart && (
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center gap-1 rounded font-medium text-white",
                    isCompact ? "mt-1.5 py-1 text-[10px]" : "mt-2 py-1.5 text-xs"
                  )}
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShoppingCart className={cn(isCompact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                  {isCompact ? "Add" : "Add to Cart"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Indicator for sample vs real data */}
      {!hasRealProducts && (
        <p className="mt-3 px-4 text-[10px] text-gray-400 text-center">
          Sample products • Configure search to load real products
        </p>
      )}
    </div>
  );
}
