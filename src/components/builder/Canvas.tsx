"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { usePageBuilderStore } from "@/lib/store/pageBuilderStore";
import { BlockWrapper } from "@/components/builder/BlockWrapper";

interface CanvasProps {
  onOpenSettings: () => void;
}

export const Canvas = ({ onOpenSettings }: CanvasProps) => {
  const blocks = usePageBuilderStore((state) => state.blocks);
  const reorderBlocks = usePageBuilderStore((state) => state.reorderBlocks);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderBlocks(oldIndex, newIndex);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between rounded-t-xl bg-slate-200 px-4 py-3">
        <span className="text-sm font-medium text-slate-700">Block Builder</span>
        <span className="text-xs text-slate-500">{blocks.length} blocks</span>
      </div>
      <div className="flex-1 overflow-hidden rounded-b-xl bg-white shadow-sm">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="h-full overflow-y-auto px-4 py-6">
              <div className="space-y-4">
                {blocks.map((block, index) => (
                  <BlockWrapper
                    key={block.id}
                    block={block}
                    index={index}
                    onOpenSettings={onOpenSettings}
                  />
                ))}

                {blocks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                      <Plus className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700">Start building</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Add blocks from the left sidebar to design your storefront.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
