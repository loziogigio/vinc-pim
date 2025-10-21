"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { usePageBuilderStore, type DeviceMode } from "@/lib/store/pageBuilderStore";
import { BlockWrapper } from "@/components/builder/BlockWrapper";

interface CanvasProps {
  onOpenSettings: () => void;
  // B2B product builder props (new interface)
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  // Admin page builder props (old interface)
  isSplitView?: boolean;
  activeTab?: "builder" | "preview";
  onSelectTab?: (tab: "builder" | "preview") => void;
  device?: DeviceMode;
}

export const Canvas = ({
  onOpenSettings,
  isVisible,
  onToggleVisibility,
  isSplitView,
  activeTab,
  onSelectTab,
  device
}: CanvasProps) => {
  const blocks = usePageBuilderStore((state) => state.blocks);
  const reorderBlocks = usePageBuilderStore((state) => state.reorderBlocks);
  const pageDetails = usePageBuilderStore((state) => state.pageDetails);

  // Check if this is a product detail page (includes SKU, Parent, and Standard templates - all have zones)
  const isProductDetailPage = pageDetails?.slug?.startsWith("sku-") || pageDetails?.slug?.startsWith("parentSku-") || pageDetails?.slug?.startsWith("standard-") || pageDetails?.slug?.startsWith("product-detail");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderBlocks(oldIndex, newIndex);
  };

  // Group blocks by zone for product detail pages (all template types: SKU, Parent, and Standard)
  const zone1Blocks = isProductDetailPage ? blocks.filter(b => b.zone === "zone1") : [];
  const zone2Blocks = isProductDetailPage ? blocks.filter(b => b.zone === "zone2") : [];
  const zone3Blocks = isProductDetailPage ? blocks.filter(b => b.zone === "zone3") : [];
  const zone4Blocks = isProductDetailPage ? blocks.filter(b => b.zone === "zone4") : [];

  // Determine which interface mode we're in
  const isB2BMode = isVisible !== undefined && onToggleVisibility !== undefined;
  const isAdminMode = isSplitView !== undefined && activeTab !== undefined;

  // B2B mode: collapsed state
  if (isB2BMode && !isVisible) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#e8eaed]">
        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex h-10 w-10 items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white text-[#6f6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]"
          aria-label="Show block builder"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Admin mode variables
  const builderTabActive = isAdminMode ? (isSplitView || activeTab === "builder") : true;
  const previewTabActive = isAdminMode ? (!isSplitView && activeTab === "preview") : false;
  const deviceLabel = device === "tablet" ? "Tablet" : device === "mobile" ? "Mobile" : "Desktop";

  return (
    <div className="flex h-full flex-col bg-[#e8eaed]">
      {/* Admin mode: Tab navigation */}
      {isAdminMode && (
        <div className="flex items-start gap-1 px-4 pt-3 text-[0.8125rem]">
          <button
            type="button"
            onClick={() => onSelectTab?.("builder")}
            className={cn(
              "cursor-pointer rounded-t-md border-b-2 px-4 py-2 font-semibold transition",
              builderTabActive
                ? "border-[#009688] bg-white text-[#009688]"
                : "border-transparent bg-transparent text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
            )}
          >
            Builder
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.("preview")}
            className={cn(
              "cursor-pointer rounded-t-md border-b-2 px-4 py-2 font-semibold transition",
              previewTabActive
                ? "border-[#009688] bg-white text-[#009688]"
                : "border-transparent bg-transparent text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
            )}
          >
            {isSplitView ? `Preview · ${deviceLabel}` : "Preview"}
          </button>
        </div>
      )}

      {/* B2B mode: Header with close button */}
      {isB2BMode && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-[0.9rem] font-semibold text-[#514c68]">Block Builder</span>
            <span className="rounded-[12px] bg-white px-2 py-[0.15rem] text-[0.7rem] font-semibold text-[#6f6885] shadow-sm">
              {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleVisibility}
            className="flex h-8 w-8 items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white text-[#6f6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]"
            aria-label="Hide block builder"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden px-2 pb-3">
        <div className="h-full overflow-hidden rounded-b-[0.428rem] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="h-full overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-[#d8d6de] scrollbar-track-[#fafafc]">
              {isProductDetailPage ? (
                // Product detail page with zones (SKU, Parent, and Standard templates)
                <div className="space-y-4">
                  {/* Zone 1: Sidebar - Under wishlist/share buttons (right column) */}
                  <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <h4 className="text-xs font-bold text-blue-700">Sidebar</h4>
                      <span className="text-xs text-blue-600">({zone1Blocks.length})</span>
                    </div>
                    <SortableContext items={zone1Blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {zone1Blocks.map((block) => (
                          <BlockWrapper
                            key={block.id}
                            block={block}
                            index={blocks.findIndex(b => b.id === block.id)}
                            onOpenSettings={onOpenSettings}
                          />
                        ))}
                        {zone1Blocks.length === 0 && (
                          <p className="py-3 text-center text-xs italic text-blue-400">No blocks in this zone</p>
                        )}
                      </div>
                    </SortableContext>
                  </div>

                  {/* Zone 2: After Gallery - Full width section after product images */}
                  <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <h4 className="text-xs font-bold text-green-700">After Gallery</h4>
                      <span className="text-xs text-green-600">({zone2Blocks.length})</span>
                    </div>
                    <SortableContext items={zone2Blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {zone2Blocks.map((block) => (
                          <BlockWrapper
                            key={block.id}
                            block={block}
                            index={blocks.findIndex(b => b.id === block.id)}
                            onOpenSettings={onOpenSettings}
                          />
                        ))}
                        {zone2Blocks.length === 0 && (
                          <p className="py-3 text-center text-xs italic text-green-400">No blocks in this zone</p>
                        )}
                      </div>
                    </SortableContext>
                  </div>

                  {/* Zone 3: New Tab - Add as a new tab alongside Descrizione/Documenti */}
                  <div className="rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                      <h4 className="text-xs font-bold text-purple-700">New Tab</h4>
                      <span className="text-xs text-purple-600">({zone3Blocks.length})</span>
                    </div>
                    <SortableContext items={zone3Blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {zone3Blocks.map((block) => (
                          <BlockWrapper
                            key={block.id}
                            block={block}
                            index={blocks.findIndex(b => b.id === block.id)}
                            onOpenSettings={onOpenSettings}
                          />
                        ))}
                        {zone3Blocks.length === 0 && (
                          <p className="py-3 text-center text-xs italic text-purple-400">No blocks in this zone</p>
                        )}
                      </div>
                    </SortableContext>
                  </div>

                  {/* Zone 4: Bottom Section - Full width section below all tabs */}
                  <div className="rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                      <h4 className="text-xs font-bold text-orange-700">Bottom Section</h4>
                      <span className="text-xs text-orange-600">({zone4Blocks.length})</span>
                    </div>
                    <SortableContext items={zone4Blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {zone4Blocks.map((block) => (
                          <BlockWrapper
                            key={block.id}
                            block={block}
                            index={blocks.findIndex(b => b.id === block.id)}
                            onOpenSettings={onOpenSettings}
                          />
                        ))}
                        {zone4Blocks.length === 0 && (
                          <p className="py-3 text-center text-xs italic text-orange-400">No blocks in this zone</p>
                        )}
                      </div>
                    </SortableContext>
                  </div>

                  {blocks.length === 0 && (
                    <div className="rounded-[8px] border border-dashed border-[#d8d6de] bg-[#fafafc] px-6 py-16 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8eaed]">
                        <Plus className="h-8 w-8 text-[#b9b9c3]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-[#5e5873]">Start building</h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-[#b9b9c3]">
                        Add blocks from the left sidebar to customize this product page.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Regular page: Show all blocks in one list
                <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {blocks.map((block, index) => (
                      <BlockWrapper
                        key={block.id}
                        block={block}
                        index={index}
                        onOpenSettings={onOpenSettings}
                      />
                    ))}

                    {blocks.length === 0 && (
                      <div className="rounded-[8px] border border-dashed border-[#d8d6de] bg-[#fafafc] px-6 py-16 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8eaed]">
                          <Plus className="h-8 w-8 text-[#b9b9c3]" />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#5e5873]">Start building</h3>
                        <p className="mt-2 text-[14px] leading-relaxed text-[#b9b9c3]">
                          Add blocks from the left sidebar to design your storefront.
                        </p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              )}
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
};
