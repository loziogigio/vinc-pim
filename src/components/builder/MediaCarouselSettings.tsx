"use client";

import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoveUp, MoveDown, Upload } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface MediaItem {
  id: string;
  mediaType: "image" | "video";
  imageDesktop?: { url: string; alt: string };
  imageMobile?: { url: string; alt: string };
  videoUrl?: string;
  link?: { url: string; openInNewTab: boolean };
  title?: string;
}

interface CarouselCardStyle {
  borderWidth: number;
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted" | "none";
  borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  shadowSize: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  shadowColor: string;
  backgroundColor: string;
  hoverEffect: "none" | "lift" | "shadow" | "scale" | "border" | "glow";
  hoverScale?: number;
  hoverShadowSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  hoverBackgroundColor?: string;
}

interface MediaCarouselSettingsProps {
  blockId: string;
  config: any;
  onSave: (config: any) => void;
}

// Image Upload Field Component
function ImageUploadField({
  label,
  value,
  onChange,
  placeholder,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadState, uploadImage, resetError } = useImageUpload();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetError();
    const cdnUrl = await uploadImage(file);

    if (cdnUrl) {
      onChange(cdnUrl);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState.isUploading}
            className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadState.isUploading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" />
                {uploadState.progress}%
              </>
            ) : (
              <>
                <Upload className="h-3 w-3" />
                Upload
              </>
            )}
          </button>
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        {uploadState.error && (
          <p className="text-xs text-red-600">{uploadState.error}</p>
        )}
      </div>
    </div>
  );
}

export function MediaCarouselSettings({ blockId, config, onSave }: MediaCarouselSettingsProps) {
  const { t } = useTranslation();
  // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const defaultCardStyle: CarouselCardStyle = {
    borderWidth: 0,
    borderColor: "#EAEEF2",
    borderStyle: "solid",
    borderRadius: "md",
    shadowSize: "none",
    shadowColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#ffffff",
    hoverEffect: "none",
    hoverScale: 1.02,
    hoverShadowSize: "lg",
    hoverBackgroundColor: ""
  };

  const [items, setItems] = useState<MediaItem[]>(config.items || []);
  const [variant, setVariant] = useState<"promo" | "brand" | "flyer">(config.variant || "promo");
  const [breakpointMode, setBreakpointMode] = useState<"simplified" | "advanced">(
    config.breakpointMode || "simplified"
  );
  const [itemsToShow, setItemsToShow] = useState({
    desktop: config.itemsToShow?.desktop || 5.5,
    tablet: config.itemsToShow?.tablet || 4.5,
    mobile: config.itemsToShow?.mobile || 2.5
  });
  const [breakpointsJSON, setBreakpointsJSON] = useState(
    JSON.stringify(config.breakpointsJSON || {
      "1536": { slidesPerView: 5.5, spaceBetween: 20 },
      "768": { slidesPerView: 4.5, spaceBetween: 16 },
      "520": { slidesPerView: 3.5, spaceBetween: 12 },
      "0": { slidesPerView: 2.5, spaceBetween: 5 }
    }, null, 2)
  );
  const [autoplay, setAutoplay] = useState(config.autoplay ?? false);
  const [loop, setLoop] = useState(config.loop ?? false);
  const [cardStyle, setCardStyle] = useState<CarouselCardStyle>({
    ...defaultCardStyle,
    ...(config.cardStyle || {})
  });
  const [showStyling, setShowStyling] = useState(false);

  const addItem = () => {
    const newItem: MediaItem = {
      id: `item-${Date.now()}`,
      mediaType: "image",
      imageDesktop: { url: "", alt: "" },
      imageMobile: { url: "", alt: "" },
      link: { url: "", openInNewTab: false },
      title: ""
    };
    setItems([...items, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    ) {
      return;
    }

    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof MediaItem, value: any) => {
    const newItems = [...items];
    if (field === "link" || field === "imageDesktop" || field === "imageMobile") {
      newItems[index] = { ...newItems[index], [field]: value };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const updateCardStyleField = <K extends keyof CarouselCardStyle>(
    field: K,
    value: CarouselCardStyle[K]
  ) => {
    setCardStyle((prev) => {
      const next: CarouselCardStyle = {
        ...prev,
        [field]: value
      };

      if (field === "borderStyle" && value === "none") {
        next.borderWidth = 0;
      }

      if (field === "hoverEffect") {
        if (value === "shadow" || value === "glow") {
          next.hoverShadowSize = next.hoverShadowSize || "lg";
        } else {
          next.hoverShadowSize = undefined;
        }
      }

      return next;
    });
  };

  // Track if this is the initial mount to avoid triggering onSave on first render
  const isInitialMount = useRef(true);

  // Auto-sync settings to parent whenever they change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    try {
      const baseConfig: any = {
        items,
        variant,
        breakpointMode,
        autoplay,
        loop,
        cardStyle,
        className: config.className || "mb-12 xl:mb-14 pt-1"
      };

      let finalConfig;
      if (breakpointMode === "simplified") {
        finalConfig = { ...baseConfig, itemsToShow };
      } else {
        try {
          finalConfig = { ...baseConfig, breakpointsJSON: JSON.parse(breakpointsJSON) };
        } catch {
          finalConfig = { ...baseConfig, breakpointsJSON: config.breakpointsJSON };
        }
      }

      onSaveRef.current(finalConfig);
    } catch (error) {
      console.error("Error syncing config:", error);
    }
  }, [items, variant, breakpointMode, autoplay, loop, cardStyle, config.className, config.breakpointsJSON, itemsToShow, breakpointsJSON]);

  return (
    <div className="space-y-6">
      {/* Variant Selection */}
      <div>
        <Label className="text-base font-semibold">{t("components.builder.mediaCarousel.carouselType")}</Label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={variant === "promo"}
              onChange={() => setVariant("promo")}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("components.builder.mediaCarousel.variantPromoBanner")}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={variant === "brand"}
              onChange={() => setVariant("brand")}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("components.builder.mediaCarousel.variantBrandLogos")}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={variant === "flyer"}
              onChange={() => setVariant("flyer")}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("components.builder.mediaCarousel.variantFlyersCatalogs")}</span>
          </label>
        </div>
      </div>

      {/* Items Management */}
      <div>
        <div className="mb-3">
          <Label className="text-base font-semibold">{t("components.builder.mediaCarousel.mediaItems")}</Label>
        </div>

        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">{t("components.builder.mediaCarousel.noItemsYet")}</p>
          ) : (
            items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{t("components.builder.mediaCarousel.itemNumber", { number: String(index + 1) })}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0}
                    >
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveItem(index, "down")}
                      disabled={index === items.length - 1}
                    >
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Media Type */}
                  <div>
                    <Label className="text-xs">{t("components.builder.mediaCarousel.mediaType")}</Label>
                    <div className="mt-1 flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={item.mediaType === "image"}
                          onChange={() => updateItem(index, "mediaType", "image")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{t("components.builder.mediaCarousel.mediaTypeImage")}</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={item.mediaType === "video"}
                          onChange={() => updateItem(index, "mediaType", "video")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{t("components.builder.mediaCarousel.mediaTypeVideo")}</span>
                      </label>
                    </div>
                  </div>

                  {item.mediaType === "image" ? (
                    <>
                      {/* Desktop Image */}
                      <ImageUploadField
                        label={t("components.builder.mediaCarousel.desktopImageUrl")}
                        value={item.imageDesktop?.url || ""}
                        onChange={(url) =>
                          updateItem(index, "imageDesktop", {
                            url,
                            alt: item.imageDesktop?.alt || ""
                          })
                        }
                        placeholder="https://example.com/image-desktop.jpg"
                      />

                      {/* Mobile Image */}
                      <ImageUploadField
                        label={t("components.builder.mediaCarousel.mobileImageUrl")}
                        value={item.imageMobile?.url || ""}
                        onChange={(url) =>
                          updateItem(index, "imageMobile", {
                            url,
                            alt: item.imageMobile?.alt || ""
                          })
                        }
                        placeholder="https://example.com/image-mobile.jpg"
                      />

                      {/* Alt Text */}
                      <div>
                        <Label className="text-xs">{t("components.builder.mediaCarousel.altText")}</Label>
                        <Input
                          type="text"
                          value={item.imageDesktop?.alt || ""}
                          onChange={(e) => {
                            updateItem(index, "imageDesktop", {
                              url: item.imageDesktop?.url || "",
                              alt: e.target.value
                            });
                            updateItem(index, "imageMobile", {
                              url: item.imageMobile?.url || "",
                              alt: e.target.value
                            });
                          }}
                          placeholder={t("components.builder.mediaCarousel.altTextPlaceholder")}
                          className="mt-1"
                        />
                      </div>
                    </>
                  ) : (
                    /* Video URL */
                    <div>
                      <Label className="text-xs">{t("components.builder.mediaCarousel.videoUrl")}</Label>
                      <Input
                        type="text"
                        value={item.videoUrl || ""}
                        onChange={(e) => updateItem(index, "videoUrl", e.target.value)}
                        placeholder="https://www.youtube.com/embed/..."
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Link */}
                  <div>
                    <Label className="text-xs">{t("components.builder.mediaCarousel.linkUrl")}</Label>
                    <Input
                      type="text"
                      value={item.link?.url || ""}
                      onChange={(e) =>
                        updateItem(index, "link", {
                          url: e.target.value,
                          openInNewTab: item.link?.openInNewTab || false
                        })
                      }
                      placeholder="https://example.com/product"
                      className="mt-1"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`openInNewTab-${index}`}
                        checked={item.link?.openInNewTab || false}
                        onChange={(e) =>
                          updateItem(index, "link", {
                            url: item.link?.url || "",
                            openInNewTab: e.target.checked
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={`openInNewTab-${index}`} className="cursor-pointer text-xs">
                        {t("components.builder.mediaCarousel.openInNewTab")}
                      </Label>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <Label className="text-xs">{t("components.builder.mediaCarousel.itemTitle")}</Label>
                    <Input
                      type="text"
                      value={item.title || ""}
                      onChange={(e) => updateItem(index, "title", e.target.value)}
                      placeholder={t("components.builder.mediaCarousel.itemTitlePlaceholder")}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Button type="button" onClick={addItem} size="sm" variant="outline" className="mt-4">
          <Plus className="mr-1 h-4 w-4" /> {t("components.builder.mediaCarousel.addItem")}
        </Button>
      </div>

      {/* Breakpoint Mode */}
      <div>
        <Label className="text-base font-semibold">{t("components.builder.mediaCarousel.responsiveSettings")}</Label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={breakpointMode === "simplified"}
              onChange={() => setBreakpointMode("simplified")}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("components.builder.mediaCarousel.breakpointSimplified")}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={breakpointMode === "advanced"}
              onChange={() => setBreakpointMode("advanced")}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("components.builder.mediaCarousel.breakpointAdvanced")}</span>
          </label>
        </div>
      </div>

      {/* Simplified Breakpoints */}
      {breakpointMode === "simplified" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{t("components.builder.mediaCarousel.breakpointDesktop")}</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.desktop}
              onChange={(e) => setItemsToShow({ ...itemsToShow, desktop: parseFloat(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("components.builder.mediaCarousel.breakpointTablet")}</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.tablet}
              onChange={(e) => setItemsToShow({ ...itemsToShow, tablet: parseFloat(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("components.builder.mediaCarousel.breakpointMobile")}</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.mobile}
              onChange={(e) => setItemsToShow({ ...itemsToShow, mobile: parseFloat(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>
  )}

  {/* Advanced Breakpoints */}
  {breakpointMode === "advanced" && (
    <div>
          <Label className="text-xs">{t("components.builder.mediaCarousel.breakpointsJson")}</Label>
          <textarea
            value={breakpointsJSON}
            onChange={(e) => setBreakpointsJSON(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-sm"
            placeholder={`{
  "1536": { "slidesPerView": 5.5, "spaceBetween": 20 },
  "0": { "slidesPerView": 2.5, "spaceBetween": 5 }
}`}
      />
    </div>
  )}

  {/* Card Styling Options */}
  <div className="rounded-lg border border-slate-200 bg-white">
    <button
      type="button"
      onClick={() => setShowStyling((prev) => !prev)}
      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700"
    >
      <span>{t("components.builder.mediaCarousel.cardStyling")}</span>
      <span className="text-xs text-slate-400">{showStyling ? t("components.builder.mediaCarousel.hide") : t("components.builder.mediaCarousel.show")}</span>
    </button>
    {showStyling ? (
      <div className="space-y-4 border-t border-slate-200 px-4 py-4">
        <div>
          <Label className="text-xs font-medium text-slate-700">
            {t("components.builder.mediaCarousel.borderWidth")}: {cardStyle.borderWidth}px
          </Label>
          <input
            type="range"
            min={0}
            max={8}
            value={cardStyle.borderWidth}
            onChange={(event) => updateCardStyleField("borderWidth", Number(event.target.value))}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.borderColor")}</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={cardStyle.borderColor}
                onChange={(event) => updateCardStyleField("borderColor", event.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-slate-200"
              />
              <Input
                value={cardStyle.borderColor}
                onChange={(event) => updateCardStyleField("borderColor", event.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.backgroundColor")}</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={cardStyle.backgroundColor}
                onChange={(event) => updateCardStyleField("backgroundColor", event.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-slate-200"
              />
              <Input
                value={cardStyle.backgroundColor}
                onChange={(event) => updateCardStyleField("backgroundColor", event.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.borderStyle")}</Label>
            <select
              value={cardStyle.borderStyle}
              onChange={(event) =>
                updateCardStyleField("borderStyle", event.target.value as CarouselCardStyle["borderStyle"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="solid">{t("components.builder.mediaCarousel.borderStyleSolid")}</option>
              <option value="dashed">{t("components.builder.mediaCarousel.borderStyleDashed")}</option>
              <option value="dotted">{t("components.builder.mediaCarousel.borderStyleDotted")}</option>
              <option value="none">{t("common.none")}</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.cornerRoundness")}</Label>
            <select
              value={cardStyle.borderRadius}
              onChange={(event) =>
                updateCardStyleField("borderRadius", event.target.value as CarouselCardStyle["borderRadius"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="none">{t("components.builder.mediaCarousel.radiusSquare")}</option>
              <option value="sm">{t("components.builder.mediaCarousel.radiusSlightly")}</option>
              <option value="md">{t("components.builder.mediaCarousel.radiusModerately")}</option>
              <option value="lg">{t("components.builder.mediaCarousel.radiusVery")}</option>
              <option value="xl">{t("components.builder.mediaCarousel.radiusExtra")}</option>
              <option value="2xl">{t("components.builder.mediaCarousel.radiusSuper")}</option>
              <option value="full">{t("components.builder.mediaCarousel.radiusFull")}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.shadowSize")}</Label>
            <select
              value={cardStyle.shadowSize}
              onChange={(event) =>
                updateCardStyleField("shadowSize", event.target.value as CarouselCardStyle["shadowSize"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="none">{t("components.builder.mediaCarousel.shadowNone")}</option>
              <option value="sm">{t("components.builder.mediaCarousel.shadowSmall")}</option>
              <option value="md">{t("components.builder.mediaCarousel.shadowMedium")}</option>
              <option value="lg">{t("components.builder.mediaCarousel.shadowLarge")}</option>
              <option value="xl">{t("components.builder.mediaCarousel.shadowExtraLarge")}</option>
              <option value="2xl">{t("components.builder.mediaCarousel.shadowHuge")}</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.shadowColor")}</Label>
            <Input
              value={cardStyle.shadowColor}
              onChange={(event) => updateCardStyleField("shadowColor", event.target.value)}
              className="mt-1 h-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.hoverEffect")}</Label>
          <select
            value={cardStyle.hoverEffect}
            onChange={(event) =>
              updateCardStyleField("hoverEffect", event.target.value as CarouselCardStyle["hoverEffect"])
            }
            className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="none">{t("common.none")}</option>
            <option value="lift">{t("components.builder.mediaCarousel.hoverLift")}</option>
            <option value="shadow">{t("components.builder.mediaCarousel.hoverShadow")}</option>
            <option value="scale">{t("components.builder.mediaCarousel.hoverScale")}</option>
            <option value="border">{t("components.builder.mediaCarousel.hoverBorder")}</option>
            <option value="glow">{t("components.builder.mediaCarousel.hoverGlow")}</option>
          </select>
        </div>

        {cardStyle.hoverEffect === "scale" ? (
          <div>
            <Label className="text-xs font-medium text-slate-700">
              {t("components.builder.mediaCarousel.hoverScaleLabel")}: {(cardStyle.hoverScale ?? 1.02).toFixed(2)}×
            </Label>
            <input
              type="range"
              min={1}
              max={1.1}
              step={0.01}
              value={cardStyle.hoverScale ?? 1.02}
              onChange={(event) => updateCardStyleField("hoverScale", Number(event.target.value))}
              className="w-full"
            />
          </div>
        ) : null}

        {["shadow", "glow"].includes(cardStyle.hoverEffect) ? (
          <div>
            <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.hoverShadowSize")}</Label>
            <select
              value={cardStyle.hoverShadowSize ?? "lg"}
              onChange={(event) =>
                updateCardStyleField("hoverShadowSize", event.target.value as CarouselCardStyle["hoverShadowSize"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="sm">{t("components.builder.mediaCarousel.shadowSmall")}</option>
              <option value="md">{t("components.builder.mediaCarousel.shadowMedium")}</option>
              <option value="lg">{t("components.builder.mediaCarousel.shadowLarge")}</option>
              <option value="xl">{t("components.builder.mediaCarousel.shadowExtraLarge")}</option>
              <option value="2xl">{t("components.builder.mediaCarousel.shadowHuge")}</option>
            </select>
          </div>
        ) : null}

        <div>
          <Label className="text-xs font-medium text-slate-700">{t("components.builder.mediaCarousel.hoverBackground")}</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={cardStyle.hoverBackgroundColor || "#ffffff"}
              onChange={(event) => updateCardStyleField("hoverBackgroundColor", event.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-slate-200"
            />
            <Input
              value={cardStyle.hoverBackgroundColor || ""}
              placeholder={t("components.builder.mediaCarousel.optionalHexColor")}
              onChange={(event) => updateCardStyleField("hoverBackgroundColor", event.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    ) : null}
  </div>

  {/* Carousel Options */}
  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <Label className="text-sm font-semibold text-slate-700">{t("components.builder.mediaCarousel.carouselOptions")}</Label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
            />
            {t("components.builder.mediaCarousel.autoplay")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
            {t("components.builder.mediaCarousel.loopSlides")}
          </label>
        </div>
      </div>

    </div>
  );
}
