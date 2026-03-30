"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import type { ProductDetailZone } from "@/lib/types/blocks";
import { LayoutGrid, LayoutPanelTop, TabletSmartphone, LayoutPanelLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ZoneSelectorProps {
  zone?: ProductDetailZone;
  tabLabel?: string;
  onChange: (zone: ProductDetailZone, tabLabel?: string) => void;
}

const ZONE_OPTIONS = [
  {
    value: "zone1" as const,
    icon: LayoutPanelLeft
  },
  {
    value: "zone2" as const,
    icon: LayoutPanelTop
  },
  {
    value: "zone3" as const,
    icon: TabletSmartphone,
    needsTabLabel: true
  },
  {
    value: "zone4" as const,
    icon: LayoutGrid
  }
];

export function ZoneSelector({ zone = "zone3", tabLabel = "", onChange }: ZoneSelectorProps) {
  const { t } = useTranslation();

  const handleZoneChange = (newZone: ProductDetailZone) => {
    onChange(newZone, tabLabel);
  };

  const handleTabLabelChange = (newLabel: string) => {
    onChange(zone, newLabel);
  };

  const selectedOption = ZONE_OPTIONS.find(opt => opt.value === zone);

  const zoneLabels: Record<string, { label: string; description: string }> = {
    zone1: {
      label: t("components.builder.zoneSelector.zone1Label"),
      description: t("components.builder.zoneSelector.zone1Description"),
    },
    zone2: {
      label: t("components.builder.zoneSelector.zone2Label"),
      description: t("components.builder.zoneSelector.zone2Description"),
    },
    zone3: {
      label: t("components.builder.zoneSelector.zone3Label"),
      description: t("components.builder.zoneSelector.zone3Description"),
    },
    zone4: {
      label: t("components.builder.zoneSelector.zone4Label"),
      description: t("components.builder.zoneSelector.zone4Description"),
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">{t("components.builder.zoneSelector.placementLabel")}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("components.builder.zoneSelector.placementHint")}
        </p>
      </div>

      <RadioGroup value={zone} onValueChange={handleZoneChange}>
        <div className="space-y-3">
          {ZONE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = zone === option.value;
            const { label, description } = zoneLabels[option.value];

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
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {description}
                    </p>
                  </div>
                </label>

                {/* Tab label input for zone3 */}
                {option.needsTabLabel && isSelected && (
                  <div className="ml-9 space-y-2">
                    <Label htmlFor="tabLabel" className="text-xs">
                      {t("components.builder.zoneSelector.tabLabelField")} *
                    </Label>
                    <Input
                      id="tabLabel"
                      value={tabLabel}
                      onChange={(e) => handleTabLabelChange(e.target.value)}
                      placeholder={t("components.builder.zoneSelector.tabLabelPlaceholder")}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("components.builder.zoneSelector.tabLabelHint")}
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
        <p className="text-xs font-medium mb-2">{t("components.builder.zoneSelector.previewLabel")}</p>
        <div className="text-xs text-muted-foreground">
          {selectedOption?.value === "zone1" && (
            <>{t("components.builder.zoneSelector.previewZone1")}</>
          )}
          {selectedOption?.value === "zone2" && (
            <>{t("components.builder.zoneSelector.previewZone2")}</>
          )}
          {selectedOption?.value === "zone3" && (
            <>{t("components.builder.zoneSelector.previewZone3", { tabLabel: tabLabel ? ` "${tabLabel}"` : "" })}</>
          )}
          {selectedOption?.value === "zone4" && (
            <>{t("components.builder.zoneSelector.previewZone4")}</>
          )}
        </div>
      </div>
    </div>
  );
}
