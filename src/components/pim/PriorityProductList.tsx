"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useLanguageStore } from "@/lib/stores/languageStore";
import type { MultiLangString, ProductImage, ProductAnalytics } from "@/lib/types/pim";

// CDN base URL from environment variable
const CDN_BASE_URL = process.env.NEXT_PUBLIC_CDN_ENDPOINT && process.env.NEXT_PUBLIC_CDN_BUCKET
  ? `${process.env.NEXT_PUBLIC_CDN_ENDPOINT}/${process.env.NEXT_PUBLIC_CDN_BUCKET}`
  : "";

/**
 * Construct full CDN URL from relative path
 */
function constructCDNUrl(relativePath?: string): string {
  if (!relativePath) return "";
  if (relativePath.startsWith("http")) return relativePath;
  if (!CDN_BASE_URL) return relativePath;
  const normalizedPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${CDN_BASE_URL}${normalizedPath}`;
}

/**
 * PIM Product for priority list display
 * Uses shared types from @/lib/types/pim
 */
type PriorityProduct = {
  _id: string;
  entity_code: string;
  sku: string;
  name: MultiLangString;
  completeness_score: number;
  critical_issues: string[];
  analytics: ProductAnalytics;
  images?: ProductImage[];
};

export function PriorityProductList() {
  const [products, setProducts] = useState<PriorityProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { languages, fetchLanguages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  useEffect(() => {
    fetchLanguages();

    async function fetchPriorityProducts() {
      try {
        const res = await fetch("/api/b2b/pim/products?sort=priority&limit=10&status=draft");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error("Error fetching priority products:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPriorityProducts();
  }, []);

  /**
   * Get localized product name with fallback to SKU
   */
  const getProductName = (name: MultiLangString, sku: string): string => {
    if (!name) return sku;
    if (typeof name === "string") return name;
    return name[defaultLanguageCode] || name.it || name.en || Object.values(name)[0] || sku;
  };

  /**
   * Get cover image URL (position 0) with CDN prefix
   */
  const getCoverImageUrl = (images?: ProductImage[]): string | null => {
    if (!images || images.length === 0) return null;
    const coverImage = images.find(img => img.position === 0) || images[0];
    return coverImage?.url ? constructCDNUrl(coverImage.url) : null;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Priority Products</h2>
        </div>
        <div className="flex h-32 items-center justify-center text-center text-muted-foreground">
          <p className="text-sm">No priority items. All products with high traffic have good quality scores!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Priority Products</h2>
        </div>
        <Link
          href="/b2b/pim/products?sort=priority"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        High-traffic products with low quality scores - fix these first for maximum impact
      </p>

      <div className="space-y-2">
        {products.map((product) => {
          const coverImageUrl = getCoverImageUrl(product.images);
          const productName = getProductName(product.name, product.sku);

          return (
            <Link
              key={product._id}
              href={`/b2b/pim/products/${product.entity_code}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition"
            >
              {/* Image */}
              <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                {coverImageUrl ? (
                  <Image
                    src={coverImageUrl}
                    alt={productName}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    No img
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground">{product.sku}</span>
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                    Priority: {product.analytics.priority_score.toFixed(1)}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground truncate">{productName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {product.analytics.views_30d} views · {product.completeness_score}% complete
                </div>
              </div>

              {/* Issues & Score */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {product.critical_issues.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {product.critical_issues.length}
                  </div>
                )}

                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    product.completeness_score >= 80
                      ? "bg-emerald-100 text-emerald-700"
                      : product.completeness_score >= 50
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {product.completeness_score}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
