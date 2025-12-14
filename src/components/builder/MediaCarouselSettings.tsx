"use client";

import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoveUp, MoveDown, Upload } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";

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
        <Label className="text-base font-semibold">Carousel Type</Label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={variant === "promo"}
              onChange={() => setVariant("promo")}
              className="h-4 w-4"
            />
            <span className="text-sm">Promo Banner</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={variant === "brand"}
              onChange={() => setVariant("brand")}
              className="h-4 w-4"
            />
            <span className="text-sm">Brand Logos</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={variant === "flyer"}
              onChange={() => setVariant("flyer")}
              className="h-4 w-4"
            />
            <span className="text-sm">Flyers/Catalogs</span>
          </label>
        </div>
      </div>

      {/* Items Management */}
      <div>
        <div className="mb-3">
          <Label className="text-base font-semibold">Media Items</Label>
        </div>

        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No items added yet. Click &quot;Add Item&quot; to get started.</p>
          ) : (
            items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Item {index + 1}</span>
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
                    <Label className="text-xs">Media Type</Label>
                    <div className="mt-1 flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={item.mediaType === "image"}
                          onChange={() => updateItem(index, "mediaType", "image")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Image</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={item.mediaType === "video"}
                          onChange={() => updateItem(index, "mediaType", "video")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Video</span>
                      </label>
                    </div>
                  </div>

                  {item.mediaType === "image" ? (
                    <>
                      {/* Desktop Image */}
                      <ImageUploadField
                        label="Desktop Image URL"
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
                        label="Mobile Image URL (optional)"
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
                        <Label className="text-xs">Alt Text</Label>
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
                          placeholder="Describe the image"
                          className="mt-1"
                        />
                      </div>
                    </>
                  ) : (
                    /* Video URL */
                    <div>
                      <Label className="text-xs">Video URL (YouTube/Vimeo embed)</Label>
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
                    <Label className="text-xs">Link URL (optional)</Label>
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
                        Open in new tab
                      </Label>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <Label className="text-xs">Title (optional)</Label>
                    <Input
                      type="text"
                      value={item.title || ""}
                      onChange={(e) => updateItem(index, "title", e.target.value)}
                      placeholder="Item title"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Button type="button" onClick={addItem} size="sm" variant="outline" className="mt-4">
          <Plus className="mr-1 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Breakpoint Mode */}
      <div>
        <Label className="text-base font-semibold">Responsive Settings</Label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={breakpointMode === "simplified"}
              onChange={() => setBreakpointMode("simplified")}
              className="h-4 w-4"
            />
            <span className="text-sm">Simplified</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={breakpointMode === "advanced"}
              onChange={() => setBreakpointMode("advanced")}
              className="h-4 w-4"
            />
            <span className="text-sm">Advanced (JSON)</span>
          </label>
        </div>
      </div>

      {/* Simplified Breakpoints */}
      {breakpointMode === "simplified" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Desktop (≥1024px)</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.desktop}
              onChange={(e) => setItemsToShow({ ...itemsToShow, desktop: parseFloat(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tablet (≥768px)</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.tablet}
              onChange={(e) => setItemsToShow({ ...itemsToShow, tablet: parseFloat(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Mobile (&lt;768px)</Label>
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
          <Label className="text-xs">Breakpoints JSON (Swiper.js format)</Label>
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
      <span>Card styling</span>
      <span className="text-xs text-slate-400">{showStyling ? "Hide" : "Show"}</span>
    </button>
    {showStyling ? (
      <div className="space-y-4 border-t border-slate-200 px-4 py-4">
        <div>
          <Label className="text-xs font-medium text-slate-700">
            Border width: {cardStyle.borderWidth}px
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
            <Label className="text-xs font-medium text-slate-700">Border color</Label>
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
            <Label className="text-xs font-medium text-slate-700">Background color</Label>
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
            <Label className="text-xs font-medium text-slate-700">Border style</Label>
            <select
              value={cardStyle.borderStyle}
              onChange={(event) =>
                updateCardStyleField("borderStyle", event.target.value as CarouselCardStyle["borderStyle"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Corner roundness</Label>
            <select
              value={cardStyle.borderRadius}
              onChange={(event) =>
                updateCardStyleField("borderRadius", event.target.value as CarouselCardStyle["borderRadius"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="none">Square</option>
              <option value="sm">Slightly rounded</option>
              <option value="md">Moderately rounded</option>
              <option value="lg">Very rounded</option>
              <option value="xl">Extra rounded</option>
              <option value="2xl">Super rounded</option>
              <option value="full">Fully rounded</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Shadow size</Label>
            <select
              value={cardStyle.shadowSize}
              onChange={(event) =>
                updateCardStyleField("shadowSize", event.target.value as CarouselCardStyle["shadowSize"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="none">No shadow</option>
              <option value="sm">Small shadow</option>
              <option value="md">Medium shadow</option>
              <option value="lg">Large shadow</option>
              <option value="xl">Extra large</option>
              <option value="2xl">Huge shadow</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Shadow color</Label>
            <Input
              value={cardStyle.shadowColor}
              onChange={(event) => updateCardStyleField("shadowColor", event.target.value)}
              className="mt-1 h-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">Hover effect</Label>
          <select
            value={cardStyle.hoverEffect}
            onChange={(event) =>
              updateCardStyleField("hoverEffect", event.target.value as CarouselCardStyle["hoverEffect"])
            }
            className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="none">None</option>
            <option value="lift">Lift up</option>
            <option value="shadow">Add shadow</option>
            <option value="scale">Grow slightly</option>
            <option value="border">Highlight border</option>
            <option value="glow">Glow effect</option>
          </select>
        </div>

        {cardStyle.hoverEffect === "scale" ? (
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Hover scale: {(cardStyle.hoverScale ?? 1.02).toFixed(2)}×
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
            <Label className="text-xs font-medium text-slate-700">Hover shadow size</Label>
            <select
              value={cardStyle.hoverShadowSize ?? "lg"}
              onChange={(event) =>
                updateCardStyleField("hoverShadowSize", event.target.value as CarouselCardStyle["hoverShadowSize"])
              }
              className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra large</option>
              <option value="2xl">Huge</option>
            </select>
          </div>
        ) : null}

        <div>
          <Label className="text-xs font-medium text-slate-700">Hover background</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={cardStyle.hoverBackgroundColor || "#ffffff"}
              onChange={(event) => updateCardStyleField("hoverBackgroundColor", event.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-slate-200"
            />
            <Input
              value={cardStyle.hoverBackgroundColor || ""}
              placeholder="Optional hex color"
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
    <Label className="text-sm font-semibold text-slate-700">Carousel options</Label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
            />
            Autoplay
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
            Loop slides
          </label>
        </div>
      </div>

    </div>
  );
}
