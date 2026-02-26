"use client";

import { X, Eye, EyeOff } from "lucide-react";
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
  MobileMediaGalleryBlock,
  MobileCategorySliderBlock,
  MobileCategoryGalleryBlock,
  MobileEntitySliderBlock,
  MobileEntityGalleryBlock,
  BlockVisibility,
} from "@/lib/types/mobile-builder";
import { MOBILE_BLOCK_LIBRARY } from "@/lib/types/mobile-builder";
import { MediaItemsEditor } from "./MediaItemsEditor";
import { ProductSliderSettings, ProductGallerySettings } from "./ProductBlockSettings";
import { CategorySliderSettings, CategoryGallerySettings } from "./CategoryBlockSettings";
import { EntitySliderSettings, EntityGallerySettings } from "./EntityBlockSettings";

interface MobileBlockSettingsProps {
  block: MobileBlock;
  onUpdate: (updates: Partial<MobileBlock>) => void;
  onClose: () => void;
}

// ============================================================================
// Visibility Settings (common for all blocks)
// ============================================================================

export function VisibilitySettings({
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
      case "mobile_category_slider":
        return <CategorySliderSettings block={block as MobileCategorySliderBlock} onUpdate={onUpdate as any} />;
      case "mobile_category_gallery":
        return <CategoryGallerySettings block={block as MobileCategoryGalleryBlock} onUpdate={onUpdate as any} />;
      case "mobile_entity_slider":
        return <EntitySliderSettings block={block as MobileEntitySliderBlock} onUpdate={onUpdate as any} />;
      case "mobile_entity_gallery":
        return <EntityGallerySettings block={block as MobileEntityGalleryBlock} onUpdate={onUpdate as any} />;
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
