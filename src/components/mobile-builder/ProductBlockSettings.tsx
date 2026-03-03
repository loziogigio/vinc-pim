"use client";

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
import { ProductSearchPreview } from "@/components/shared/ProductSearchPreview";
import type {
  MobileProductSliderBlock,
  MobileProductGalleryBlock,
} from "@/lib/types/mobile-builder";
import { VisibilitySettings } from "./MobileBlockSettings";

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
            <SelectItem value="reminder">Customer reminded products</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Search (only for search source) */}
      {(block.settings.source || "search") === "search" ? (
        <ProductSearchPreview
          searchQuery={block.search_query || ""}
          limit={block.limit || 10}
          cachedProducts={block._cached_products}
          onSearchChange={(query) => onUpdate({ search_query: query })}
          onLimitChange={(limit) => onUpdate({ limit })}
          onProductsLoaded={(products) => onUpdate({ _cached_products: products })}
        />
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
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
            <SelectItem value="reminder">Customer reminded products</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Search (only for search source) */}
      {(block.settings.source || "search") === "search" ? (
        <ProductSearchPreview
          searchQuery={block.search_query || ""}
          limit={block.limit || 12}
          cachedProducts={block._cached_products}
          onSearchChange={(query) => onUpdate({ search_query: query })}
          onLimitChange={(limit) => onUpdate({ limit })}
          onProductsLoaded={(products) => onUpdate({ _cached_products: products })}
        />
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
          Products are loaded automatically by the mobile app.
        </p>
      )}
    </div>
  );
}
