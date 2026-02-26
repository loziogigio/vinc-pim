"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Loader2, FolderOpen, Check } from "lucide-react";
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
  MobileCategorySliderBlock,
  MobileCategoryGalleryBlock,
  CachedCategory,
} from "@/lib/types/mobile-builder";
import { VisibilitySettings } from "./MobileBlockSettings";

// ============================================================================
// Category Picker Settings (shared by slider and gallery)
// ============================================================================

function CategoryPickerSettings({
  selectedIds,
  cachedCategories,
  onSelectionChange,
  onCategoriesLoaded,
}: {
  selectedIds: string[];
  cachedCategories?: CachedCategory[];
  onSelectionChange: (ids: string[]) => void;
  onCategoriesLoaded: (categories: CachedCategory[]) => void;
}) {
  const pathname = usePathname() || "";
  const tenantId = pathname.match(/^\/([^/]+)\/b2b/)?.[1] || "";
  const [allCategories, setAllCategories] = useState<CachedCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCategoriesLoadedRef = useRef(onCategoriesLoaded);
  useEffect(() => {
    onCategoriesLoadedRef.current = onCategoriesLoaded;
  }, [onCategoriesLoaded]);

  // Fetch categories on mount
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (tenantId) headers["X-Tenant-ID"] = tenantId;

        const res = await fetch("/api/b2b/pim/categories", {
          headers,
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load categories");
        const data = await res.json();
        const cats: CachedCategory[] = (data.categories || [])
          .filter((c: any) => c.is_active !== false)
          .map((c: any) => ({
            category_id: c.category_id,
            name: c.name,
            slug: c.slug,
            hero_image_url: c.hero_image?.url,
            product_count: c.product_count || 0,
          }));
        setAllCategories(cats);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Failed to load categories");
          console.error("Category fetch error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [tenantId]);

  // Update cached categories when selection changes
  useEffect(() => {
    if (!allCategories.length) return;
    const selected = allCategories.filter((c) => selectedIds.includes(c.category_id));
    onCategoriesLoadedRef.current(selected);
  }, [selectedIds, allCategories]);

  const toggleCategory = (catId: string) => {
    const next = selectedIds.includes(catId)
      ? selectedIds.filter((id) => id !== catId)
      : [...selectedIds, catId];
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-gray-500" />
        <Label className="font-medium">Categories</Label>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading categories...
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!isLoading && allCategories.length === 0 && !error && (
        <p className="text-xs text-gray-500">No categories found.</p>
      )}

      {allCategories.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {allCategories.map((cat) => {
            const isSelected = selectedIds.includes(cat.category_id);
            return (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => toggleCategory(cat.category_id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                  isSelected
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex h-4 w-4 items-center justify-center rounded border border-current">
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                {cat.hero_image_url ? (
                  <img src={cat.hero_image_url} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-100">
                    <FolderOpen className="h-3 w-3 text-gray-400" />
                  </div>
                )}
                <span className="flex-1 truncate">{cat.name}</span>
                <span className="text-[10px] text-gray-400">{cat.product_count}</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-gray-500">{selectedIds.length} selected</p>
      )}
    </div>
  );
}

// ============================================================================
// Category Slider Settings
// ============================================================================

export function CategorySliderSettings({
  block,
  onUpdate,
}: {
  block: MobileCategorySliderBlock;
  onUpdate: (updates: Partial<MobileCategorySliderBlock>) => void;
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
            placeholder="Categories"
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
        <Label>Show Product Count</Label>
        <Switch
          checked={block.settings.show_product_count}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_product_count: checked } })
          }
        />
      </div>

      <CategoryPickerSettings
        selectedIds={block.selected_category_ids || []}
        cachedCategories={block._cached_categories}
        onSelectionChange={(ids) => onUpdate({ selected_category_ids: ids })}
        onCategoriesLoaded={(cats) => onUpdate({ _cached_categories: cats })}
      />
    </div>
  );
}

// ============================================================================
// Category Gallery Settings
// ============================================================================

export function CategoryGallerySettings({
  block,
  onUpdate,
}: {
  block: MobileCategoryGalleryBlock;
  onUpdate: (updates: Partial<MobileCategoryGalleryBlock>) => void;
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
            placeholder="Categories"
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

      <div className="flex items-center justify-between">
        <Label>Show Product Count</Label>
        <Switch
          checked={block.settings.show_product_count}
          onCheckedChange={(checked) =>
            onUpdate({ settings: { ...block.settings, show_product_count: checked } })
          }
        />
      </div>

      <CategoryPickerSettings
        selectedIds={block.selected_category_ids || []}
        cachedCategories={block._cached_categories}
        onSelectionChange={(ids) => onUpdate({ selected_category_ids: ids })}
        onCategoriesLoaded={(cats) => onUpdate({ _cached_categories: cats })}
      />
    </div>
  );
}
