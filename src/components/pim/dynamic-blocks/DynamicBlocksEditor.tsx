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
} from "@dnd-kit/sortable";
import { useState } from "react";
import { Plus, Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { getEnabledLanguages } from "@/config/languages";
import { DynamicBlock, DynamicBlockSection } from "@/lib/types/dynamic-blocks";
import {
  DYNAMIC_BLOCKS_MAX_COUNT,
  DYNAMIC_BLOCK_SECTIONS,
} from "@/lib/constants/dynamic-blocks";
import { BlockCard } from "./BlockCard";

interface DynamicBlocksEditorProps {
  entityCode: string;
  value: DynamicBlock[];
  onChange: (blocks: DynamicBlock[]) => void;
  disabled: boolean;
}

export function DynamicBlocksEditor({ entityCode, value, onChange, disabled }: DynamicBlocksEditorProps) {
  const { t } = useTranslation();
  const languages = getEnabledLanguages();
  const [activeLang, setActiveLang] = useState(languages[0]?.code ?? "it");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const atBlockCap = value.length >= DYNAMIC_BLOCKS_MAX_COUNT;

  function blocksFor(lang: string, section: DynamicBlockSection): DynamicBlock[] {
    return value
      .filter((b) => b.lang === lang && b.section === section)
      .sort((a, b) => a.order - b.order);
  }

  function updateBlock(updated: DynamicBlock) {
    onChange(value.map((b) => (b.id === updated.id ? updated : b)));
  }

  function deleteBlock(id: string) {
    onChange(value.filter((b) => b.id !== id));
  }

  function addBlock(section: DynamicBlockSection) {
    if (atBlockCap) return;
    const order = blocksFor(activeLang, section).length;
    const block: DynamicBlock = {
      id: crypto.randomUUID(),
      lang: activeLang,
      title: undefined,
      section,
      order,
      columns: 2,
      is_active: true,
      elements: [],
    };
    onChange([...value, block]);
  }

  function handleBlockDragEnd(event: DragEndEvent, section: DynamicBlockSection) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const group = blocksFor(activeLang, section);
    const oldIndex = group.findIndex((b) => b.id === active.id);
    const newIndex = group.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(group, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
    const reorderedById = new Map(reordered.map((b) => [b.id, b]));
    onChange(value.map((b) => reorderedById.get(b.id) ?? b));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-foreground" />
        <h3 className="text-lg font-semibold text-foreground">{t("pages.pim.dynamicBlocks.title")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("pages.pim.dynamicBlocks.blockCount", {
            count: String(value.length),
            max: String(DYNAMIC_BLOCKS_MAX_COUNT),
          })}
        </span>
      </div>

      {/* Catalog-language tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {languages.map((lang) => {
          const count = value.filter((b) => b.lang === lang.code).length;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setActiveLang(lang.code)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                activeLang === lang.code
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang.nativeName}
              {count > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sections for the active language */}
      <div className="space-y-6">
        {DYNAMIC_BLOCK_SECTIONS.map((section) => {
          const group = blocksFor(activeLang, section);
          return (
            <div key={section} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("pages.pim.dynamicBlocks.sectionLabel", { section: String(section) })}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({group.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => addBlock(section)}
                  disabled={disabled || atBlockCap}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3 w-3" />
                  {t("pages.pim.dynamicBlocks.addBlock")}
                </button>
              </div>

              {group.length === 0 ? (
                <p className="rounded border-2 border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  {t("pages.pim.dynamicBlocks.noBlocks")}
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleBlockDragEnd(e, section)}
                >
                  <SortableContext items={group.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {group.map((block) => (
                        <BlockCard
                          key={block.id}
                          entityCode={entityCode}
                          block={block}
                          onChange={updateBlock}
                          onDelete={deleteBlock}
                          disabled={disabled}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          );
        })}
      </div>

      {atBlockCap && (
        <p className="text-xs text-amber-600">
          {t("pages.pim.dynamicBlocks.blockCap", { max: String(DYNAMIC_BLOCKS_MAX_COUNT) })}
        </p>
      )}
    </div>
  );
}
