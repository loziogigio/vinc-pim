"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, RotateCcw, Save, Loader2, X } from "lucide-react";
import { SectionCard } from "./section-card";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type {
  IB2BPortalFacetConfig,
  IB2BPortalFacetEntry,
} from "@/lib/types/b2b-portal";
import type { DiscoveredFacetField } from "@/lib/search/facet-discovery";

// ============================================
// Defaults
// ============================================

// Order mirrors the storefront's DEFAULT_FACET_ORDER (vinc-b2b
// framework/basic-rest/utils/filters.ts) so "Reset to defaults" reproduces the
// storefront's no-config render order: promo → novità → brand → category →
// product type → stock.
export const DEFAULT_FACET_ENTRIES: IB2BPortalFacetEntry[] = [
  { field: "promo_type", visible: true },
  { field: "attribute_is_new_b", visible: true },
  { field: "brand_id", visible: true },
  { field: "category_ancestors", visible: true },
  { field: "product_type_code", visible: true },
  { field: "stock_status", visible: true },
];

// ============================================
// Pure helpers
// ============================================

/** Immutably move the entry at `from` to position `to`. */
export function move(
  entries: IB2BPortalFacetEntry[],
  from: number,
  to: number
): IB2BPortalFacetEntry[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= entries.length ||
    to >= entries.length
  ) {
    return entries;
  }
  return arrayMove(entries, from, to);
}

// ============================================
// Source badge
// ============================================

function SourceBadge({ source }: { source: DiscoveredFacetField["source"] }) {
  const { t } = useTranslation();
  const label =
    source === "attribute"
      ? t("components.facetsSection.sourceAttribute")
      : source === "spec"
        ? t("components.facetsSection.sourceSpec")
        : t("components.facetsSection.sourceStatic");
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
      {label}
    </span>
  );
}

// ============================================
// Configured (sortable) row
// ============================================

function ConfiguredRow({
  entry,
  label,
  source,
  onToggleVisible,
  onRemove,
}: {
  entry: IB2BPortalFacetEntry;
  label: string;
  source: DiscoveredFacetField["source"];
  onToggleVisible: (visible: boolean) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.field });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
    >
      <button
        type="button"
        className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-1 truncate text-sm text-foreground">{label}</span>

      <SourceBadge source={source} />

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={entry.visible}
          onChange={(e) => onToggleVisible(e.target.checked)}
          className="rounded border-border"
        />
        {t("components.facetsSection.visible")}
      </label>

      <button
        type="button"
        onClick={onRemove}
        title={t("components.facetsSection.remove")}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================
// Facets Section
// ============================================

interface FacetsSectionProps {
  facetConfig: IB2BPortalFacetConfig | undefined;
  onChange: (cfg: IB2BPortalFacetConfig) => void;
  saving: boolean;
  onSave: () => void;
}

export function FacetsSection({
  facetConfig,
  onChange,
  saving,
  onSave,
}: FacetsSectionProps) {
  const { t } = useTranslation();
  const [discovered, setDiscovered] = useState<DiscoveredFacetField[]>([]);
  const [loadError, setLoadError] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/search/facet-fields", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setDiscovered(Array.isArray(data.fields) ? data.fields : []);
        setLoadError(Boolean(data.degraded));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = facetConfig?.entries ?? [];

  // Lookup maps from the discovered fields.
  const labelMap = new Map(discovered.map((f) => [f.field, f.label]));
  const sourceMap = new Map(discovered.map((f) => [f.field, f.source]));

  const resolveLabel = (field: string) => labelMap.get(field) ?? field;
  const resolveSource = (field: string): DiscoveredFacetField["source"] =>
    sourceMap.get(field) ?? "static";

  const configuredFields = new Set(entries.map((e) => e.field));
  const available = discovered.filter((f) => !configuredFields.has(f.field));

  function emit(nextEntries: IB2BPortalFacetEntry[]) {
    onChange({ entries: nextEntries });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((e) => e.field === active.id);
    const to = entries.findIndex((e) => e.field === over.id);
    const next = move(entries, from, to);
    if (next !== entries) emit(next);
  }

  function toggleVisible(index: number, visible: boolean) {
    emit(entries.map((e, i) => (i === index ? { ...e, visible } : e)));
  }

  function remove(index: number) {
    emit(entries.filter((_, i) => i !== index));
  }

  function add(field: string) {
    emit([...entries, { field, visible: true }]);
  }

  function resetDefaults() {
    emit(DEFAULT_FACET_ENTRIES.map((e) => ({ ...e })));
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={t("components.facetsSection.title")}
        description={t("components.facetsSection.description")}
      >
        {loadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            {t("components.facetsSection.loadError")}
          </div>
        )}

        {/* Configured (ordered) list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {t("components.facetsSection.configured")}
            </h3>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("components.facetsSection.resetDefaults")}
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              {t("components.facetsSection.empty")}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={entries.map((e) => e.field)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {entries.map((entry, index) => (
                    <ConfiguredRow
                      key={entry.field}
                      entry={entry}
                      label={resolveLabel(entry.field)}
                      source={resolveSource(entry.field)}
                      onToggleVisible={(visible) =>
                        toggleVisible(index, visible)
                      }
                      onRemove={() => remove(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Available list */}
        {available.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              {t("components.facetsSection.available")}
            </h3>
            <div className="space-y-2">
              {available.map((f) => (
                <div
                  key={f.field}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5"
                >
                  <span className="flex-1 truncate text-sm text-foreground">
                    {f.label || f.field}
                  </span>
                  <SourceBadge source={f.source} />
                  <button
                    type="button"
                    onClick={() => add(f.field)}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("components.facetsSection.add")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
