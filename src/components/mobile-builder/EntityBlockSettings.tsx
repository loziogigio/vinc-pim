"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Layers, Tag, ChevronLeft, ChevronRight } from "lucide-react";
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
  MobileEntitySliderBlock,
  MobileEntityGalleryBlock,
  EntitySource,
  CachedEntity,
} from "@/lib/types/mobile-builder";
import {
  ENTITY_SOURCES,
  ENTITY_SOURCE_LABELS,
  ENTITY_SOURCE_API,
  ENTITY_SEARCH_FILTER,
} from "@/lib/types/mobile-builder";
import { VisibilitySettings } from "./MobileBlockSettings";

// ============================================================================
// Entity Response → CachedEntity mapper
// ============================================================================

function mapResponseToEntities(source: EntitySource, data: any): CachedEntity[] {
  switch (source) {
    case "brand":
      return (data.brands || [])
        .filter((b: any) => b.is_active !== false)
        .map((b: any) => ({
          id: b.brand_id,
          name: b.label,
          slug: b.slug,
          image_url: b.logo_url || undefined,
          product_count: b.product_count || 0,
          filter_value: b.brand_id,
        }));

    case "collection":
      return (data.collections || [])
        .filter((c: any) => c.is_active !== false)
        .map((c: any) => ({
          id: c.collection_id,
          name: c.name,
          slug: c.slug,
          image_url: c.hero_image?.url || undefined,
          product_count: c.product_count || 0,
          filter_value: c.slug,
        }));

    case "product_type":
      return (data.productTypes || [])
        .filter((pt: any) => pt.is_active !== false)
        .map((pt: any) => ({
          id: pt.product_type_id,
          name:
            typeof pt.name === "string"
              ? pt.name
              : pt.name?.it || pt.name?.en || Object.values(pt.name || {})[0] || pt.slug || "",
          slug: pt.slug,
          image_url: undefined,
          product_count: pt.product_count || 0,
          filter_value: pt.code || pt.product_type_id,
        }));
  }
}

// ============================================================================
// Entity Loader Settings (paginated fetch by source)
// ============================================================================

const ENTITY_PAGE_SIZE = 50;

function EntityLoaderSettings({
  entitySource,
  cachedEntities,
  onSourceChange,
  onEntitiesLoaded,
}: {
  entitySource: EntitySource;
  cachedEntities?: CachedEntity[];
  onSourceChange: (source: EntitySource) => void;
  onEntitiesLoaded: (entities: CachedEntity[]) => void;
}) {
  const pathname = usePathname() || "";
  const tenantId = pathname.match(/^\/([^/]+)\/b2b/)?.[1] || "";
  const [entities, setEntities] = useState<CachedEntity[]>(cachedEntities || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const onEntitiesLoadedRef = useRef(onEntitiesLoaded);
  useEffect(() => {
    onEntitiesLoadedRef.current = onEntitiesLoaded;
  }, [onEntitiesLoaded]);

  // Reset page when source changes
  useEffect(() => {
    setPage(1);
  }, [entitySource]);

  const fetchEntities = useCallback(
    async (pageNum: number, signal: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (tenantId) headers["X-Tenant-ID"] = tenantId;

        // Brands: paginated with image_label sort (with-image first, then alphabetical)
        let url: string;
        if (entitySource === "brand") {
          const params = new URLSearchParams({
            page: String(pageNum),
            limit: String(ENTITY_PAGE_SIZE),
            sort_by: "image_label",
            sort_order: "desc",
          });
          url = `${ENTITY_SOURCE_API[entitySource]}?${params}`;
        } else {
          url = ENTITY_SOURCE_API[entitySource];
        }

        const res = await fetch(url, {
          headers,
          credentials: "include",
          signal,
        });

        if (!res.ok) throw new Error(`Failed to load ${ENTITY_SOURCE_LABELS[entitySource]}`);

        const data = await res.json();
        const mapped = mapResponseToEntities(entitySource, data);
        setEntities(mapped);
        onEntitiesLoadedRef.current(mapped);

        // Set pagination info from API response
        if (data.pagination) {
          setTotalPages(data.pagination.pages || 1);
          setTotal(data.pagination.total || mapped.length);
        } else {
          setTotalPages(1);
          setTotal(mapped.length);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError(err?.message || "Failed to load entities");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [entitySource, tenantId]
  );

  // Fetch entities whenever source or page changes
  useEffect(() => {
    const controller = new AbortController();
    fetchEntities(page, controller.signal);
    return () => controller.abort();
  }, [fetchEntities, page]);

  return (
    <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-gray-500" />
        <Label className="font-medium">Entity Source</Label>
      </div>

      <Select
        value={entitySource}
        onValueChange={(v) => onSourceChange(v as EntitySource)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENTITY_SOURCES.map((src) => (
            <SelectItem key={src} value={src}>
              {ENTITY_SOURCE_LABELS[src]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading {ENTITY_SOURCE_LABELS[entitySource].toLowerCase()}...
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!isLoading && entities.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">
            {total} {ENTITY_SOURCE_LABELS[entitySource].toLowerCase()} total
            {totalPages > 1 && ` — page ${page}/${totalPages}`}
          </Label>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
              >
                {entity.image_url ? (
                  <img
                    src={entity.image_url}
                    alt=""
                    className="h-6 w-6 rounded object-contain"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-100">
                    <Tag className="h-3 w-3 text-gray-400" />
                  </div>
                )}
                <span className="flex-1 truncate">{entity.name}</span>
                <span className="text-[10px] text-gray-400">
                  {entity.product_count}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </button>
              <span className="text-[10px] text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {!isLoading && entities.length === 0 && !error && (
        <p className="text-xs text-gray-500">
          No {ENTITY_SOURCE_LABELS[entitySource].toLowerCase()} found.
        </p>
      )}

      <p className="text-[10px] text-gray-400">
        Filter:{" "}
        <code className="rounded bg-gray-100 px-1">
          filters-{ENTITY_SEARCH_FILTER[entitySource]}
        </code>
      </p>
    </div>
  );
}

// ============================================================================
// Entity Slider Settings
// ============================================================================

export function EntitySliderSettings({
  block,
  onUpdate,
}: {
  block: MobileEntitySliderBlock;
  onUpdate: (updates: Partial<MobileEntitySliderBlock>) => void;
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
            placeholder={ENTITY_SOURCE_LABELS[block.settings.entity_source]}
          />
        </div>
      )}

      <div>
        <Label>Items Visible</Label>
        <Select
          value={String(block.settings.items_visible)}
          onValueChange={(value) =>
            onUpdate({
              settings: { ...block.settings, items_visible: parseInt(value) },
            })
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
            onUpdate({
              settings: { ...block.settings, show_product_count: checked },
            })
          }
        />
      </div>

      <EntityLoaderSettings
        entitySource={block.settings.entity_source}
        cachedEntities={block._cached_entities}
        onSourceChange={(source) =>
          onUpdate({
            settings: {
              ...block.settings,
              entity_source: source,
              title: ENTITY_SOURCE_LABELS[source],
            },
            _cached_entities: [],
          })
        }
        onEntitiesLoaded={(entities) => onUpdate({ _cached_entities: entities })}
      />
    </div>
  );
}

// ============================================================================
// Entity Gallery Settings
// ============================================================================

export function EntityGallerySettings({
  block,
  onUpdate,
}: {
  block: MobileEntityGalleryBlock;
  onUpdate: (updates: Partial<MobileEntityGalleryBlock>) => void;
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
            placeholder={ENTITY_SOURCE_LABELS[block.settings.entity_source]}
          />
        </div>
      )}

      <div>
        <Label>Columns</Label>
        <Select
          value={String(block.settings.columns)}
          onValueChange={(value) =>
            onUpdate({
              settings: {
                ...block.settings,
                columns: parseInt(value) as 2 | 3,
              },
            })
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
            onUpdate({
              settings: { ...block.settings, show_product_count: checked },
            })
          }
        />
      </div>

      <EntityLoaderSettings
        entitySource={block.settings.entity_source}
        cachedEntities={block._cached_entities}
        onSourceChange={(source) =>
          onUpdate({
            settings: {
              ...block.settings,
              entity_source: source,
              title: ENTITY_SOURCE_LABELS[source],
            },
            _cached_entities: [],
          })
        }
        onEntitiesLoaded={(entities) => onUpdate({ _cached_entities: entities })}
      />
    </div>
  );
}
