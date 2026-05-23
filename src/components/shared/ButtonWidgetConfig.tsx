"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";

export interface ButtonWidgetConfigData {
  label?: string;
  url?: string;
  target?: string;
  variant?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface ButtonWidgetConfigProps {
  config: ButtonWidgetConfigData;
  onConfigChange: (updates: Record<string, unknown>) => void;
}

export function ButtonWidgetConfig({
  config,
  onConfigChange,
}: ButtonWidgetConfigProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.homeSettings.widgets.label")}
        </label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => onConfigChange({ label: e.target.value })}
          placeholder={t("pages.homeSettings.widgets.buttonText")}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.homeSettings.widgets.url")}
        </label>
        <input
          type="text"
          value={config.url || ""}
          onChange={(e) => onConfigChange({ url: e.target.value })}
          placeholder="https://example.com or /path"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.homeSettings.widgets.openIn")}
        </label>
        <select
          value={config.target || "_self"}
          onChange={(e) => onConfigChange({ target: e.target.value })}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="_self">{t("pages.homeSettings.widgets.sameTab")}</option>
          <option value="_blank">{t("pages.homeSettings.widgets.newTab")}</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.homeSettings.widgets.variant")}
        </label>
        <select
          value={config.variant || "primary"}
          onChange={(e) => onConfigChange({ variant: e.target.value })}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="primary">{t("pages.homeSettings.widgets.variantPrimary")}</option>
          <option value="secondary">{t("pages.homeSettings.widgets.variantSecondary")}</option>
          <option value="outline">{t("pages.homeSettings.widgets.variantOutline")}</option>
          <option value="ghost">{t("pages.homeSettings.widgets.variantGhost")}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {t("pages.homeSettings.branding.backgroundColor")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={config.backgroundColor || "#009688"}
              onChange={(e) => onConfigChange({ backgroundColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-border"
            />
            <input
              type="text"
              value={config.backgroundColor || ""}
              onChange={(e) => onConfigChange({ backgroundColor: e.target.value })}
              placeholder="#009688"
              className="w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {t("pages.homeSettings.branding.textColor")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={config.textColor || "#ffffff"}
              onChange={(e) => onConfigChange({ textColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-border"
            />
            <input
              type="text"
              value={config.textColor || ""}
              onChange={(e) => onConfigChange({ textColor: e.target.value })}
              placeholder="#ffffff"
              className="w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
