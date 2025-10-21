"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import type { ProductDetailZone } from "@/lib/types/blocks";
import { LayoutGrid, LayoutPanelTop, TabletSmartphone, LayoutPanelLeft } from "lucide-react";

interface ZoneSelectorProps {
  zone?: ProductDetailZone;
  tabLabel?: string;
  onChange: (zone: ProductDetailZone, tabLabel?: string) => void;
}

const ZONE_OPTIONS = [
  {
    value: "zone1" as const,
    label: "Sidebar",
    description: "Under wishlist/share buttons (right column)",
    icon: LayoutPanelLeft
  },
  {
    value: "zone2" as const,
    label: "After Gallery",
    description: "Full width section after product images",
    icon: LayoutPanelTop
  },
  {
    value: "zone3" as const,
    label: "New Tab",
    description: "Add as a new tab alongside Descrizione/Documenti",
    icon: TabletSmartphone,
    needsTabLabel: true
  },
  {
    value: "zone4" as const,
    label: "Bottom Section",
    description: "Full width section below all tabs",
    icon: LayoutGrid
  }
];

export function ZoneSelector({ zone = "zone3", tabLabel = "", onChange }: ZoneSelectorProps) {
  const handleZoneChange = (newZone: ProductDetailZone) => {
    onChange(newZone, tabLabel);
  };

  const handleTabLabelChange = (newLabel: string) => {
    onChange(zone, newLabel);
  };

  const selectedOption = ZONE_OPTIONS.find(opt => opt.value === zone);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Placement on Product Page</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Choose where this block should appear
        </p>
      </div>

      <RadioGroup value={zone} onValueChange={handleZoneChange}>
        <div className="space-y-3">
          {ZONE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = zone === option.value;

            return (
              <div key={option.value} className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                </label>

                {/* Tab label input for zone3 */}
                {option.needsTabLabel && isSelected && (
                  <div className="ml-9 space-y-2">
                    <Label htmlFor="tabLabel" className="text-xs">
                      Tab Label *
                    </Label>
                    <Input
                      id="tabLabel"
                      value={tabLabel}
                      onChange={(e) => handleTabLabelChange(e.target.value)}
                      placeholder="e.g., Video, Installation Guide, Downloads"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      This will appear as a new tab in the product detail page
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </RadioGroup>

      {/* Visual preview */}
      <div className="mt-4 p-3 bg-muted rounded-lg">
        <p className="text-xs font-medium mb-2">Preview:</p>
        <div className="text-xs text-muted-foreground">
          {selectedOption?.value === "zone1" && (
            <>This block will appear in the <strong>right sidebar</strong>, under the wishlist and share buttons</>
          )}
          {selectedOption?.value === "zone2" && (
            <>This block will appear <strong>below the product gallery</strong>, spanning full width</>
          )}
          {selectedOption?.value === "zone3" && (
            <>This block will appear as a <strong>new tab</strong>{tabLabel ? ` labeled "${tabLabel}"` : ""}</>
          )}
          {selectedOption?.value === "zone4" && (
            <>This block will appear at the <strong>bottom of the page</strong>, below all tabs</>
          )}
        </div>
      </div>
    </div>
  );
}
