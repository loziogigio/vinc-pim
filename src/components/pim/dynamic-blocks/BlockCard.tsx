"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { BlockElement, DynamicBlock, DynamicBlockColumns, DynamicBlockSection } from "@/lib/types/dynamic-blocks";
import {
  DYNAMIC_BLOCK_MAX_ELEMENTS,
  DYNAMIC_BLOCK_COLUMNS_MIN,
  DYNAMIC_BLOCK_COLUMNS_MAX,
} from "@/lib/constants/dynamic-blocks";
import { ElementRow } from "./ElementRow";

interface BlockCardProps {
  entityCode: string;
  block: DynamicBlock;
  onChange: (block: DynamicBlock) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

function newElement(): BlockElement {
  return { id: crypto.randomUUID(), kind: "image", media: { url: "" } };
}

export function BlockCard({ entityCode, block, onChange, onDelete, disabled }: BlockCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const atElementCap = block.elements.length >= DYNAMIC_BLOCK_MAX_ELEMENTS;

  function handleElementDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = block.elements.findIndex((el) => el.id === active.id);
    const newIndex = block.elements.findIndex((el) => el.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({ ...block, elements: arrayMove(block.elements, oldIndex, newIndex) });
  }

  function updateElement(updated: BlockElement) {
    onChange({
      ...block,
      elements: block.elements.map((el) => (el.id === updated.id ? updated : el)),
    });
  }

  function deleteElement(id: string) {
    onChange({ ...block, elements: block.elements.filter((el) => el.id !== id) });
  }

  function addElement() {
    if (atElementCap) return;
    onChange({ ...block, elements: [...block.elements, newElement()] });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-4 ${isDragging ? "z-50 shadow-xl" : "shadow-sm"} ${
        block.is_active ? "" : "opacity-60"
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <input
          type="text"
          value={block.title ?? ""}
          onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
          placeholder={t("pages.pim.dynamicBlocks.blockTitlePlaceholder")}
          disabled={disabled}
          className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Section selector */}
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {t("pages.pim.dynamicBlocks.section")}
          <select
            value={block.section}
            onChange={(e) => onChange({ ...block, section: Number(e.target.value) as DynamicBlockSection })}
            disabled={disabled}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            {([1, 2, 3, 4] as DynamicBlockSection[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {/* Columns selector */}
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {t("pages.pim.dynamicBlocks.columns")}
          <select
            value={block.columns}
            onChange={(e) => onChange({ ...block, columns: Number(e.target.value) as DynamicBlockColumns })}
            disabled={disabled}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            {Array.from(
              { length: DYNAMIC_BLOCK_COLUMNS_MAX - DYNAMIC_BLOCK_COLUMNS_MIN + 1 },
              (_, i) => i + DYNAMIC_BLOCK_COLUMNS_MIN
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Active toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...block, is_active: !block.is_active })}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          title={t("pages.pim.dynamicBlocks.toggleActive")}
        >
          {block.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>

        {/* Collapse */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 text-muted-foreground hover:bg-accent rounded"
          title={t("pages.pim.dynamicBlocks.collapse")}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>

        {/* Delete block */}
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          disabled={disabled}
          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
          title={t("pages.pim.dynamicBlocks.deleteBlock")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Elements */}
      {!collapsed && (
        <div className="mt-3 space-y-3">
          {block.elements.length === 0 ? (
            <p className="rounded border-2 border-dashed border-border py-4 text-center text-xs text-muted-foreground">
              {t("pages.pim.dynamicBlocks.noElements")}
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleElementDragEnd}>
              <SortableContext
                items={block.elements.map((el) => el.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {block.elements.map((el) => (
                    <ElementRow
                      key={el.id}
                      entityCode={entityCode}
                      element={el}
                      onChange={updateElement}
                      onDelete={deleteElement}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addElement}
              disabled={disabled || atElementCap}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3 w-3" />
              {t("pages.pim.dynamicBlocks.addElement")}
            </button>
            {atElementCap && (
              <span className="text-xs text-amber-600">
                {t("pages.pim.dynamicBlocks.elementCap", { max: String(DYNAMIC_BLOCK_MAX_ELEMENTS) })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
