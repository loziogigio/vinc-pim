"use client";

/**
 * Product-card defaults section of the global B2B settings page.
 *
 * Lifted from the legacy /b2b/home-settings page (`CardStyleForm` +
 * `ProductCardPreviewPanel`). Owns only presentation + per-field change
 * callbacks; the host page owns the GET/POST against /api/b2b/home-settings.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { SectionCard } from "@/components/b2c/storefront-settings/section-card";
import ProductCardPreview, { type PreviewVariant } from "@/components/home-settings/ProductCardPreview";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { CompanyBranding, ProductCardStyle } from "@/lib/types/home-settings";
import { ColorInput } from "./shared";

export const DEFAULT_CARD_STYLE: ProductCardStyle = {
  borderWidth: 1,
  borderColor: "#EAEEF2",
  borderStyle: "solid",
  shadowSize: "none",
  shadowColor: "rgba(0, 0, 0, 0.1)",
  borderRadius: "md",
  hoverEffect: "none",
  hoverScale: 1.02,
  hoverShadowSize: "lg",
  backgroundColor: "#ffffff",
  hoverBackgroundColor: undefined,
  priceDecimals: 2,
};

const CARD_VARIANTS: Array<{ value: PreviewVariant; labelKey: string; helperKey: string }> = [
  {
    value: "b2b",
    labelKey: "pages.homeSettings.product.variantVertical",
    helperKey: "pages.homeSettings.product.variantVerticalHelper",
  },
  {
    value: "horizontal",
    labelKey: "pages.homeSettings.product.variantHorizontal",
    helperKey: "pages.homeSettings.product.variantHorizontalHelper",
  },
];

interface ProductCardSectionProps {
  cardStyle: ProductCardStyle;
  cardVariant: PreviewVariant;
  onVariantChange: (variant: PreviewVariant) => void;
  onStyleChange: <K extends keyof ProductCardStyle>(key: K, value: ProductCardStyle[K]) => void;
  /** Read-only — used only to render the live preview alongside the form. */
  branding: CompanyBranding;
}

function CardStyleForm({
  cardStyle,
  cardVariant,
  onVariantChange,
  onStyleChange,
}: Pick<ProductCardSectionProps, "cardStyle" | "cardVariant" | "onVariantChange" | "onStyleChange">) {
  const { t } = useTranslation();
  return (
    <SectionCard
      title={t("pages.homeSettings.product.title")}
      description={t("pages.homeSettings.product.description")}
    >
      <div className="space-y-4">
        <label className="text-sm font-medium text-foreground/80">{t("pages.homeSettings.product.defaultLayout")}</label>
        <div className="grid gap-3 md:grid-cols-2">
          {CARD_VARIANTS.map((variant) => {
            const isActive = cardVariant === variant.value;
            return (
              <button
                key={variant.value}
                type="button"
                onClick={() => onVariantChange(variant.value)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold",
                      isActive
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {variant.value === "b2b" ? "V" : "H"}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{t(variant.labelKey)}</div>
                    <div className="text-xs text-muted-foreground">{t(variant.helperKey)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.product.borderWidth")}: {cardStyle.borderWidth}px
          </label>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={cardStyle.borderWidth}
            onChange={(event) => onStyleChange("borderWidth", Number(event.target.value))}
            className="w-full"
          />
        </div>

        <ColorInput
          id="border-color"
          label={t("pages.homeSettings.product.borderColor")}
          value={cardStyle.borderColor}
          onChange={(value) => onStyleChange("borderColor", value)}
        />

        <div className="space-y-2">
          <label htmlFor="border-style" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.product.borderStyle")}
          </label>
          <select
            id="border-style"
            value={cardStyle.borderStyle}
            onChange={(event) =>
              onStyleChange("borderStyle", event.target.value as ProductCardStyle["borderStyle"])
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="solid">{t("pages.homeSettings.product.borderSolid")}</option>
            <option value="dashed">{t("pages.homeSettings.product.borderDashed")}</option>
            <option value="dotted">{t("pages.homeSettings.product.borderDotted")}</option>
            <option value="none">{t("common.none")}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="border-radius" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.product.borderRadius")}
          </label>
          <select
            id="border-radius"
            value={cardStyle.borderRadius}
            onChange={(event) =>
              onStyleChange("borderRadius", event.target.value as ProductCardStyle["borderRadius"])
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">{t("pages.homeSettings.product.radiusSharp")}</option>
            <option value="sm">{t("pages.homeSettings.product.radiusSlight")}</option>
            <option value="md">{t("pages.homeSettings.product.radiusMedium")}</option>
            <option value="lg">{t("pages.homeSettings.product.radiusLarge")}</option>
            <option value="xl">{t("pages.homeSettings.product.radiusXl")}</option>
            <option value="2xl">{t("pages.homeSettings.product.radiusPill")}</option>
            <option value="full">{t("pages.homeSettings.product.radiusCircle")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="shadow-size" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.product.shadowSize")}
          </label>
          <select
            id="shadow-size"
            value={cardStyle.shadowSize}
            onChange={(event) =>
              onStyleChange("shadowSize", event.target.value as ProductCardStyle["shadowSize"])
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">{t("common.none")}</option>
            <option value="sm">{t("pages.homeSettings.product.sizeSmall")}</option>
            <option value="md">{t("pages.homeSettings.product.sizeMedium")}</option>
            <option value="lg">{t("pages.homeSettings.product.sizeLarge")}</option>
            <option value="xl">{t("pages.homeSettings.product.sizeXl")}</option>
            <option value="2xl">{t("pages.homeSettings.product.sizeHuge")}</option>
          </select>
        </div>

        <ColorInput
          id="shadow-color"
          label={t("pages.homeSettings.product.shadowColor")}
          value={cardStyle.shadowColor}
          onChange={(value) => onStyleChange("shadowColor", value)}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="hover-effect" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.product.hoverEffect")}
          </label>
          <select
            id="hover-effect"
            value={cardStyle.hoverEffect}
            onChange={(event) =>
              onStyleChange("hoverEffect", event.target.value as ProductCardStyle["hoverEffect"])
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">{t("common.none")}</option>
            <option value="lift">{t("pages.homeSettings.product.hoverLift")}</option>
            <option value="shadow">{t("pages.homeSettings.product.hoverShadow")}</option>
            <option value="scale">{t("pages.homeSettings.product.hoverScale")}</option>
            <option value="border">{t("pages.homeSettings.product.hoverBorder")}</option>
            <option value="glow">{t("pages.homeSettings.product.hoverGlow")}</option>
          </select>
        </div>

        {cardStyle.hoverEffect === "scale" ? (
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.product.hoverScaleLabel")}: {(cardStyle.hoverScale ?? 1.02).toFixed(2)}×
            </label>
            <input
              type="range"
              min={1}
              max={1.1}
              step={0.01}
              value={cardStyle.hoverScale ?? 1.02}
              onChange={(event) => onStyleChange("hoverScale", Number(event.target.value))}
              className="w-full"
            />
          </div>
        ) : null}

        {cardStyle.hoverEffect === "shadow" ? (
          <div className="space-y-2">
            <label htmlFor="hover-shadow" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.product.hoverShadowSize")}
            </label>
            <select
              id="hover-shadow"
              value={cardStyle.hoverShadowSize ?? "lg"}
              onChange={(event) =>
                onStyleChange("hoverShadowSize", event.target.value as ProductCardStyle["hoverShadowSize"])
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="sm">{t("pages.homeSettings.product.sizeSmall")}</option>
              <option value="md">{t("pages.homeSettings.product.sizeMedium")}</option>
              <option value="lg">{t("pages.homeSettings.product.sizeLarge")}</option>
              <option value="xl">{t("pages.homeSettings.product.sizeXl")}</option>
              <option value="2xl">{t("pages.homeSettings.product.sizeHuge")}</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ColorInput
          id="background-color"
          label={t("pages.homeSettings.branding.backgroundColor")}
          value={cardStyle.backgroundColor}
          onChange={(value) => onStyleChange("backgroundColor", value)}
        />
        <ColorInput
          id="hover-background-color"
          label={t("pages.homeSettings.product.hoverBg")}
          value={cardStyle.hoverBackgroundColor}
          onChange={(value) => onStyleChange("hoverBackgroundColor", value)}
          helper={t("pages.homeSettings.product.hoverBgHelper")}
          allowClear
          onClear={() => onStyleChange("hoverBackgroundColor", undefined)}
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80">
          {t("pages.homeSettings.product.priceDecimals")}: {cardStyle.priceDecimals ?? 2}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={cardStyle.priceDecimals ?? 2}
            onChange={(event) => onStyleChange("priceDecimals", Number(event.target.value))}
            className="w-full"
          />
          <span className="min-w-[3rem] rounded-md border border-border bg-muted px-2 py-1 text-center text-sm font-mono text-foreground">
            {(99.99).toFixed(cardStyle.priceDecimals ?? 2)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t("pages.homeSettings.product.priceDecimalsHelper")}</p>
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            onStyleChange("borderWidth", DEFAULT_CARD_STYLE.borderWidth);
            onStyleChange("borderColor", DEFAULT_CARD_STYLE.borderColor);
            onStyleChange("borderStyle", DEFAULT_CARD_STYLE.borderStyle);
            onStyleChange("shadowSize", DEFAULT_CARD_STYLE.shadowSize);
            onStyleChange("shadowColor", DEFAULT_CARD_STYLE.shadowColor);
            onStyleChange("borderRadius", DEFAULT_CARD_STYLE.borderRadius);
            onStyleChange("hoverEffect", DEFAULT_CARD_STYLE.hoverEffect);
            onStyleChange("hoverScale", DEFAULT_CARD_STYLE.hoverScale);
            onStyleChange("hoverShadowSize", DEFAULT_CARD_STYLE.hoverShadowSize);
            onStyleChange("backgroundColor", DEFAULT_CARD_STYLE.backgroundColor);
            onStyleChange("hoverBackgroundColor", DEFAULT_CARD_STYLE.hoverBackgroundColor);
            onStyleChange("priceDecimals", DEFAULT_CARD_STYLE.priceDecimals);
          }}
        >
          {t("pages.homeSettings.product.resetDefaults")}
        </Button>
      </div>
    </SectionCard>
  );
}

function ProductCardPreviewPanel({
  cardStyle,
  branding,
  previewVariant,
  onVariantChange,
}: {
  cardStyle: ProductCardStyle;
  branding: CompanyBranding;
  previewVariant: PreviewVariant;
  onVariantChange: (variant: PreviewVariant) => void;
}) {
  const { t } = useTranslation();
  const previewHeading =
    previewVariant === "horizontal"
      ? t("pages.homeSettings.preview.horizontalCard")
      : t("pages.homeSettings.preview.verticalCard");

  return (
    <SectionCard title={previewHeading} description={t("pages.homeSettings.preview.livePreview")}>
      <div className="flex gap-2 mb-4">
        {CARD_VARIANTS.map((variant) => (
          <button
            key={variant.value}
            type="button"
            onClick={() => onVariantChange(variant.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-colors",
              previewVariant === variant.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground/80 hover:border-border"
            )}
          >
            {t(variant.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/50 p-4">
        <ProductCardPreview variant={previewVariant} cardStyle={cardStyle} branding={branding} />
      </div>
    </SectionCard>
  );
}

export function ProductCardSection({
  cardStyle,
  cardVariant,
  onVariantChange,
  onStyleChange,
  branding,
}: ProductCardSectionProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2">
        <CardStyleForm
          cardStyle={cardStyle}
          cardVariant={cardVariant}
          onVariantChange={onVariantChange}
          onStyleChange={onStyleChange}
        />
      </div>
      <div className="xl:col-span-1">
        <ProductCardPreviewPanel
          cardStyle={cardStyle}
          branding={branding}
          previewVariant={cardVariant}
          onVariantChange={onVariantChange}
        />
      </div>
    </div>
  );
}
