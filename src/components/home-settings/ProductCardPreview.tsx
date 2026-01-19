"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/components/ui/utils";
import type { CompanyBranding, ProductCardStyle } from "@/lib/types/home-settings";
import { getCardStyleCSS, getCardHoverStyleCSS } from "@/lib/home-settings/style-utils";

// Local placeholder image - no external dependency
const FALLBACK_IMAGE = "/placeholder-product.svg";

const shadowBadge =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide";

const numberFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

export type PreviewVariant = "b2b" | "horizontal";

interface ProductCardPreviewProps {
  variant: PreviewVariant;
  cardStyle: ProductCardStyle;
  branding?: CompanyBranding;
  className?: string;
}

const SAMPLE_PRODUCT = {
  name: "Lavabo da Appoggio Ceramica Bianca 45cm",
  sku: "LV-824300",
  model: "MOD. CLASSIC",
  brand: { name: "HidrosPoint" },
  price: 29.1495,
  salePrice: 24.999,
  availability: "In arrivo",
  eta: "29/11/2025",
  image: FALLBACK_IMAGE
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    const chr = value.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function createPreviewClassName(cardStyle: ProductCardStyle) {
  const base = `${cardStyle.borderRadius}-${cardStyle.shadowSize}-${cardStyle.hoverEffect}-${cardStyle.borderWidth}-${cardStyle.backgroundColor}-${cardStyle.hoverBackgroundColor ?? ""}`;
  return `card-preview-${hashString(base)}`;
}

export function ProductCardPreview({
  variant,
  cardStyle,
  branding,
  className
}: ProductCardPreviewProps) {
  const previewClassName = useMemo(() => createPreviewClassName(cardStyle), [cardStyle]);
  const baseStyle = useMemo<CSSProperties>(() => {
    const style = getCardStyleCSS(cardStyle);
    return {
      ...style,
      transition: "all 180ms ease",
      transformOrigin: "center",
      overflow: "hidden"
    };
  }, [cardStyle]);

  const hoverCSS = useMemo(() => getCardHoverStyleCSS(cardStyle), [cardStyle]);
  const accentColor = branding?.primaryColor || "#009f7f";
  const secondaryColor = branding?.secondaryColor || "#02b290";

  const badgeStyle: CSSProperties = {
    background: `${accentColor}14`,
    color: accentColor
  };

  const priceColor: CSSProperties = {
    color: accentColor
  };

  const etaColor: CSSProperties = {
    color: secondaryColor
  };

  const price = numberFormatter.format(SAMPLE_PRODUCT.salePrice);
  const listPrice = numberFormatter.format(SAMPLE_PRODUCT.price);

  const verticalCard = (
    <div className="flex flex-col h-full">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <Image
          src={SAMPLE_PRODUCT.image}
          alt={SAMPLE_PRODUCT.name}
          fill
          sizes="(max-width: 1024px) 100vw, 320px"
          className="object-cover"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <span className={cn(shadowBadge)} style={badgeStyle}>
            {SAMPLE_PRODUCT.brand.name}
          </span>
          <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold uppercase text-white tracking-wide">
            {SAMPLE_PRODUCT.sku}
          </span>
        </div>
        <div className="absolute bottom-3 right-3">
          <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm">
            Promo -15%
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <div className="text-[12px] uppercase tracking-wide text-slate-500">
          {SAMPLE_PRODUCT.model}
        </div>
        <div className="line-clamp-2 text-sm font-semibold text-slate-900">
          {SAMPLE_PRODUCT.name}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <span className="font-semibold" style={priceColor}>
            {price}
          </span>
          <span className="line-through text-slate-400">{listPrice}</span>
        </div>
        <div className="text-[12px]">
          <span className="font-medium text-slate-500">Stato:</span>{" "}
          <span className="font-semibold uppercase" style={etaColor}>
            {SAMPLE_PRODUCT.availability}
          </span>
        </div>
        <div className="text-[12px] text-slate-500">
          Arrivo previsto{" "}
          <span className="font-semibold" style={etaColor}>
            {SAMPLE_PRODUCT.eta}
          </span>
        </div>
      </div>
    </div>
  );

  const horizontalCard = (
    <div className="grid h-full grid-cols-[160px_1fr] gap-4 p-4">
      <div className="relative h-full overflow-hidden rounded-md bg-gray-100">
        <Image
          src={SAMPLE_PRODUCT.image}
          alt={SAMPLE_PRODUCT.name}
          fill
          sizes="(max-width: 1024px) 100vw, 240px"
          className="object-cover"
        />
        <span className={cn("absolute left-2 top-2", shadowBadge)} style={badgeStyle}>
          {SAMPLE_PRODUCT.brand.name}
        </span>
      </div>
      <div className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[12px] uppercase tracking-wide text-slate-500">
            <span>{SAMPLE_PRODUCT.sku}</span>
            <span className="font-semibold" style={priceColor}>
              {SAMPLE_PRODUCT.model}
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
            {SAMPLE_PRODUCT.name}
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-lg font-semibold" style={priceColor}>
              {price}
            </span>
            <span className="text-slate-400 line-through">{listPrice}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[12px] text-slate-500">
          <div>
            <span className="font-medium text-slate-500">Stato:</span>{" "}
            <span className="font-semibold uppercase" style={etaColor}>
              {SAMPLE_PRODUCT.availability}
            </span>
          </div>
          <div>
            <span className="font-medium text-slate-500">Arrivo:</span>{" "}
            <span className="font-semibold" style={etaColor}>
              {SAMPLE_PRODUCT.eta}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      {hoverCSS ? (
        <style>{`.${previewClassName}:hover { ${hoverCSS} }`}</style>
      ) : null}
      <div className={cn("rounded-xl border border-transparent bg-white/40 p-4")}>
        <div
          className={cn(
            "preview-card relative isolate flex h-full w-full transform-gpu flex-col overflow-hidden",
            "border border-transparent bg-white",
            previewClassName
          )}
          style={baseStyle}
        >
          {variant === "horizontal" ? horizontalCard : verticalCard}
        </div>
      </div>
    </div>
  );
}

export default ProductCardPreview;
