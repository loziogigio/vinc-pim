"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { X, Search, Loader2, Package, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  MobileBlock,
  MobileMediaSliderBlock,
  MobileProductSliderBlock,
  MobileMediaGalleryBlock,
  MobileProductGalleryBlock,
  CachedProduct,
  BlockVisibility,
  MediaItem,
} from "@/lib/types/mobile-builder";
import { MOBILE_BLOCK_LIBRARY } from "@/lib/types/mobile-builder";
import { MediaItemsEditor } from "./MediaItemsEditor";

interface MobileBlockSettingsProps {
  block: MobileBlock;
  onUpdate: (updates: Partial<MobileBlock>) => void;
  onClose: () => void;
}

// ============================================================================
// Visibility Settings (common for all blocks)
// ============================================================================

function VisibilitySettings({
  visibility,
  onUpdate,
}: {
  visibility: BlockVisibility;
  onUpdate: (visibility: BlockVisibility) => void;
}) {
  return (
    <div className="space-y-2 border-b pb-4 mb-4">
      <Label className="text-sm font-medium">Block Visibility</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onUpdate("all")}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
            visibility === "all"
              ? "bg-primary/10 border-primary text-primary"
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <Eye className="h-4 w-4" />
          <span className="text-sm">Everyone</span>
        </button>
        <button
          type="button"
          onClick={() => onUpdate("logged_in_only")}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
            visibility === "logged_in_only"
              ? "bg-primary/10 border-primary text-primary"
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <EyeOff className="h-4 w-4" />
          <span className="text-sm">Logged In Only</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Product Search Settings (for product blocks)
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

  // Extract tenant ID from pathname (e.g., /tenant-id/b2b/... -> tenant-id)
  const tenantId = pathname.match(/^\/([^/]+)\/b2b/)?.[1] || "";

  // Use ref to avoid infinite loops with callbacks
  const onProductsLoadedRef = useRef(onProductsLoaded);
  useEffect(() => {
    onProductsLoadedRef.current = onProductsLoaded;
  }, [onProductsLoaded]);

  // Debounced search - only notify parent of query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearchChange(localQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, onSearchChange]);

  // Auto-search when query or limit changes (with debounce)
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
        // Include tenant ID via X-Tenant-ID header for session-based authentication
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (tenantId) {
          headers["X-Tenant-ID"] = tenantId;
        }

        const response = await fetch("/api/search/search", {
          method: "POST",
          headers,
          credentials: "include",
          signal: abortController.signal,
          body: JSON.stringify({
            text: localQuery,
            lang: "it",
            rows: limit,
            start: 0,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Search failed");
        }

        const data = await response.json();
        // Response structure: { success: true, data: { results: [...] } }
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
    }, 300); // 300ms debounce

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

        {/* Product Preview */}
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
// Media Slider Settings
// ============================================================================

function MediaSliderSettings({
  block,
  onUpdate,
}: {
  block: MobileMediaSliderBlock;
  onUpdate: (updates: Partial<MobileMediaSliderBlock>) => void;
}) {
  return (
    <div className="space-y-4">
      <VisibilitySettings
        visibility={block.visibility || "all"}
        onUpdate={(visibility) => onUpdate({ visibility })}
      />

      <div>
        <Label>Aspect Ratio</Label>
        <Select
          value={block.settings.aspect_ratio}
          onValueChange={(value: "16:9" | "4:3" | "1:1" | "9:16") =>
            onUpdate({ settings: { ...block.settings, aspect_ratio: value } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
            <SelectItem value="4:3">4:3 (Standard)</SelectItem>
            <SelectItem value="1:1">1:1 (Square)</SelectItem>
            <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Autoplay</Label>
        <Switch
          checked={block.settings.autoplay}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, autoplay: checked } })
          }
        />
      </div>

      {block.settings.autoplay && (
        <div>
          <Label>Autoplay Interval (ms)</Label>
          <Input
            type="number"
            value={block.settings.autoplay_interval}
            onChange={(e) =>
              onUpdate({
                settings: {
                  ...block.settings,
                  autoplay_interval: parseInt(e.target.value) || 5000,
                },
              })
            }
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label>Show Dots</Label>
        <Switch
          checked={block.settings.show_dots}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_dots: checked } })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Arrows</Label>
        <Switch
          checked={block.settings.show_arrows}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_arrows: checked } })
          }
        />
      </div>

      {/* Media Items Editor */}
      <div className="border-t pt-4">
        <MediaItemsEditor
          items={block.items}
          onChange={(items) => onUpdate({ items })}
          maxItems={10}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Product Slider Settings
// ============================================================================

function ProductSliderSettings({
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

      {/* Product Search */}
      <ProductSearchSettings
        searchQuery={block.search_query || ""}
        limit={block.limit || 10}
        cachedProducts={block._cached_products}
        onSearchChange={(query) => onUpdate({ search_query: query })}
        onLimitChange={(limit) => onUpdate({ limit })}
        onProductsLoaded={(products) => onUpdate({ _cached_products: products })}
      />
    </div>
  );
}

// ============================================================================
// Media Gallery Settings
// ============================================================================

function MediaGallerySettings({
  block,
  onUpdate,
}: {
  block: MobileMediaGalleryBlock;
  onUpdate: (updates: Partial<MobileMediaGalleryBlock>) => void;
}) {
  return (
    <div className="space-y-4">
      <VisibilitySettings
        visibility={block.visibility || "all"}
        onUpdate={(visibility) => onUpdate({ visibility })}
      />

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
          onValueChange={(value: "none" | "sm" | "md") =>
            onUpdate({ settings: { ...block.settings, gap: value } })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Media Items Editor */}
      <div className="border-t pt-4">
        <MediaItemsEditor
          items={block.items}
          onChange={(items) => onUpdate({ items })}
          maxItems={20}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Product Gallery Settings
// ============================================================================

function ProductGallerySettings({
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

      {/* Product Search */}
      <ProductSearchSettings
        searchQuery={block.search_query || ""}
        limit={block.limit || 12}
        cachedProducts={block._cached_products}
        onSearchChange={(query) => onUpdate({ search_query: query })}
        onLimitChange={(limit) => onUpdate({ limit })}
        onProductsLoaded={(products) => onUpdate({ _cached_products: products })}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MobileBlockSettings({ block, onUpdate, onClose }: MobileBlockSettingsProps) {
  const blockMeta = MOBILE_BLOCK_LIBRARY.find((b) => b.type === block.type);

  const renderSettings = () => {
    switch (block.type) {
      case "mobile_media_slider":
        return <MediaSliderSettings block={block} onUpdate={onUpdate as any} />;
      case "mobile_product_slider":
        return <ProductSliderSettings block={block} onUpdate={onUpdate as any} />;
      case "mobile_media_gallery":
        return <MediaGallerySettings block={block} onUpdate={onUpdate as any} />;
      case "mobile_product_gallery":
        return <ProductGallerySettings block={block} onUpdate={onUpdate as any} />;
      default:
        return <p className="text-sm text-gray-500">No settings available</p>;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-semibold text-gray-800">{blockMeta?.name || "Block"} Settings</h2>
          <p className="text-xs text-gray-500">{blockMeta?.description}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">{renderSettings()}</div>
    </div>
  );
}
