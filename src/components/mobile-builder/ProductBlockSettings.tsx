"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Search, Loader2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MobileProductSliderBlock,
  MobileProductGalleryBlock,
  CachedProduct,
} from "@/lib/types/mobile-builder";
import { VisibilitySettings } from "./MobileBlockSettings";

// ============================================================================
// Product Search Settings (shared by slider and gallery)
// ============================================================================

function ProductSearchSettings({
  searchQuery,
  limit,
  cachedProducts,
  onSearchChange,
  onLimitChange,
  onProductsLoaded,
}: {
  searchQuery: string;
  limit: number;
  cachedProducts?: CachedProduct[];
  onSearchChange: (query: string) => void;
  onLimitChange: (limit: number) => void;
  onProductsLoaded: (products: CachedProduct[]) => void;
}) {
  const pathname = usePathname() || "";
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const tenantId = pathname.match(/^\/([^/]+)\/b2b/)?.[1] || "";

  const onProductsLoadedRef = useRef(onProductsLoaded);
  useEffect(() => {
    onProductsLoadedRef.current = onProductsLoaded;
  }, [onProductsLoaded]);

  // Parse advanced query strings (e.g. shop?text=moon&filters-brand_id=004)
  const parsedSearchSummary = useMemo(() => {
    const trimmed = localQuery.trim();
    if (!/[?=&]/.test(trimmed)) return null;

    try {
      const queryString = trimmed.startsWith("shop?")
        ? trimmed.slice(5)
        : trimmed.startsWith("search?")
          ? trimmed.slice(7)
          : trimmed.replace(/^\?/, "");
      const params = new URLSearchParams(queryString);

      const keyword = params.get("text") || "";
      const filters: Array<{ key: string; values: string[] }> = [];

      params.forEach((value, key) => {
        if (key === "text") return;
        const normalizedKey = key.startsWith("filters-") ? key.replace(/^filters-/, "") : key;
        const values = value.split(";").map((item) => item.trim()).filter(Boolean);
        if (values.length) {
          filters.push({ key: normalizedKey, values });
        }
      });

      return { keyword, filters };
    } catch {
      return null;
    }
  }, [localQuery]);

  // Debounced search - only notify parent of query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearchChange(localQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, onSearchChange]);

  // Auto-search when query or limit changes (800ms debounce to avoid partial URL errors)
  useEffect(() => {
    if (!localQuery.trim()) {
      onProductsLoadedRef.current([]);
      return;
    }

    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (tenantId) {
          headers["X-Tenant-ID"] = tenantId;
        }

        // Build request body — support advanced queries with filters
        const trimmed = localQuery.trim();
        const requestBody: Record<string, unknown> = {
          lang: "it",
          rows: limit,
          start: 0,
        };

        if (/[?=&]/.test(trimmed)) {
          try {
            const qs = trimmed.startsWith("shop?")
              ? trimmed.slice(5)
              : trimmed.startsWith("search?")
                ? trimmed.slice(7)
                : trimmed.replace(/^\?/, "");
            const parsed = new URLSearchParams(qs);
            const extractedText = parsed.get("text");
            if (extractedText) requestBody.text = extractedText;

            const filters: Record<string, string> = {};
            parsed.forEach((value, key) => {
              if (key === "text") return;
              const filterKey = key.startsWith("filters-") ? key.replace(/^filters-/, "") : key;
              filters[filterKey] = value;
            });
            if (Object.keys(filters).length) requestBody.filters = filters;
          } catch {
            requestBody.text = trimmed;
          }
        } else {
          requestBody.text = trimmed;
        }

        const response = await fetch("/api/search/search", {
          method: "POST",
          headers,
          credentials: "include",
          signal: abortController.signal,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Search failed");
        }

        const data = await response.json();
        const results = data.data?.results || data.results || [];
        const products: CachedProduct[] = results.map((p: any) => ({
          entity_code: p.entity_code,
          sku: p.sku,
          name: p.name || "",
          cover_image_url: p.cover_image_url,
          price: p.price,
          stock_status: p.stock_status,
        }));

        onProductsLoadedRef.current(products);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearchError("Failed to search products");
          console.error("Product search error:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [localQuery, limit, tenantId]);

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-500" />
        <Label className="font-medium">Product Search</Label>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-gray-500">Search Query</Label>
          <div className="relative">
            <Input
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search products..."
              className="pr-10"
            />
            {isSearching && (
              <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Paste a keyword or an advanced query (e.g.{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">
              shop?text=moon&amp;filters-brand_id=004
            </code>
            ).
          </p>
          {parsedSearchSummary && (
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {parsedSearchSummary.keyword && (
                <div className="mb-1">
                  <span className="font-semibold text-gray-700">Keyword:</span>{" "}
                  <span>{parsedSearchSummary.keyword}</span>
                </div>
              )}
              {parsedSearchSummary.filters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {parsedSearchSummary.filters.map(({ key, values }) => (
                    <div key={key} className="flex items-center gap-1 rounded bg-white px-2 py-1">
                      <span className="text-[11px] font-semibold uppercase text-gray-500">{key}</span>
                      <span className="text-[11px] text-gray-600">{values.join(", ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs text-gray-500">Max Products</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value) || 10)}
          />
        </div>

        {searchError && (
          <p className="text-xs text-red-500">{searchError}</p>
        )}

        {cachedProducts && cachedProducts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">
              Found {cachedProducts.length} products
            </Label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {cachedProducts.map((product) => (
                <div
                  key={product.entity_code}
                  className="flex flex-col items-center p-2 bg-white rounded border"
                >
                  {product.cover_image_url ? (
                    <img
                      src={product.cover_image_url}
                      alt={product.name}
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                  <span className="text-[10px] text-gray-600 truncate w-full text-center mt-1">
                    {product.sku}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {localQuery.trim() && !isSearching && cachedProducts?.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-2">
            No products found
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Product Slider Settings
// ============================================================================

export function ProductSliderSettings({
  block,
  onUpdate,
}: {
  block: MobileProductSliderBlock;
  onUpdate: (updates: Partial<MobileProductSliderBlock>) => void;
}) {
  return (
    <div className="space-y-4">
      <VisibilitySettings
        visibility={block.visibility || "all"}
        onUpdate={(visibility) => onUpdate({ visibility })}
      />

      <div className="flex items-center justify-between">
        <Label>Show Title</Label>
        <Switch
          checked={block.settings.show_title}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_title: checked } })
          }
        />
      </div>

      {block.settings.show_title && (
        <div>
          <Label>Title</Label>
          <Input
            value={block.settings.title || ""}
            onChange={(e) =>
              onUpdate({ settings: { ...block.settings, title: e.target.value } })
            }
            placeholder="Featured Products"
          />
        </div>
      )}

      <div>
        <Label>Items Visible</Label>
        <Select
          value={String(block.settings.items_visible)}
          onValueChange={(value) =>
            onUpdate({ settings: { ...block.settings, items_visible: parseInt(value) } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 item</SelectItem>
            <SelectItem value="2">2 items</SelectItem>
            <SelectItem value="3">3 items</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Price</Label>
        <Switch
          checked={block.settings.show_price}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_price: checked } })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Add to Cart</Label>
        <Switch
          checked={block.settings.show_add_to_cart}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_add_to_cart: checked } })
          }
        />
      </div>

      {/* Data Source */}
      <div>
        <Label>Data Source</Label>
        <Select
          value={block.settings.source || "search"}
          onValueChange={(value) =>
            onUpdate({ settings: { ...block.settings, source: value as any } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="search">Keyword / advanced query</SelectItem>
            <SelectItem value="trending">Trending products</SelectItem>
            <SelectItem value="liked">Customer liked products</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Search (only for search source) */}
      {(block.settings.source || "search") === "search" ? (
        <ProductSearchSettings
          searchQuery={block.search_query || ""}
          limit={block.limit || 10}
          cachedProducts={block._cached_products}
          onSearchChange={(query) => onUpdate({ search_query: query })}
          onLimitChange={(limit) => onUpdate({ limit })}
          onProductsLoaded={(products) => onUpdate({ _cached_products: products })}
        />
      ) : (
        <p className="text-xs text-gray-500 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center">
          Products are loaded automatically by the mobile app.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Product Gallery Settings
// ============================================================================

export function ProductGallerySettings({
  block,
  onUpdate,
}: {
  block: MobileProductGalleryBlock;
  onUpdate: (updates: Partial<MobileProductGalleryBlock>) => void;
}) {
  return (
    <div className="space-y-4">
      <VisibilitySettings
        visibility={block.visibility || "all"}
        onUpdate={(visibility) => onUpdate({ visibility })}
      />

      <div className="flex items-center justify-between">
        <Label>Show Title</Label>
        <Switch
          checked={block.settings.show_title}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_title: checked } })
          }
        />
      </div>

      {block.settings.show_title && (
        <div>
          <Label>Title</Label>
          <Input
            value={block.settings.title || ""}
            onChange={(e) =>
              onUpdate({ settings: { ...block.settings, title: e.target.value } })
            }
            placeholder="Products"
          />
        </div>
      )}

      <div>
        <Label>Columns</Label>
        <Select
          value={String(block.settings.columns)}
          onValueChange={(value) =>
            onUpdate({ settings: { ...block.settings, columns: parseInt(value) as 2 | 3 } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 columns</SelectItem>
            <SelectItem value="3">3 columns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Gap</Label>
        <Select
          value={block.settings.gap}
          onValueChange={(value: "sm" | "md") =>
            onUpdate({ settings: { ...block.settings, gap: value } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Card Style</Label>
        <Select
          value={block.settings.card_style}
          onValueChange={(value: "compact" | "detailed") =>
            onUpdate({ settings: { ...block.settings, card_style: value } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Price</Label>
        <Switch
          checked={block.settings.show_price}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_price: checked } })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Add to Cart</Label>
        <Switch
          checked={block.settings.show_add_to_cart}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_add_to_cart: checked } })
          }
        />
      </div>

      {/* Data Source */}
      <div>
        <Label>Data Source</Label>
        <Select
          value={block.settings.source || "search"}
          onValueChange={(value) =>
            onUpdate({ settings: { ...block.settings, source: value as any } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="search">Keyword / advanced query</SelectItem>
            <SelectItem value="trending">Trending products</SelectItem>
            <SelectItem value="liked">Customer liked products</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Search (only for search source) */}
      {(block.settings.source || "search") === "search" ? (
        <ProductSearchSettings
          searchQuery={block.search_query || ""}
          limit={block.limit || 12}
          cachedProducts={block._cached_products}
          onSearchChange={(query) => onUpdate({ search_query: query })}
          onLimitChange={(limit) => onUpdate({ limit })}
          onProductsLoaded={(products) => onUpdate({ _cached_products: products })}
        />
      ) : (
        <p className="text-xs text-gray-500 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center">
          Products are loaded automatically by the mobile app.
        </p>
      )}
    </div>
  );
}
