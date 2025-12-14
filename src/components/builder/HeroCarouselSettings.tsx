"use client";

import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Upload, MoveUp, MoveDown } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";

type OverlayPosition = "top" | "middle" | "bottom";

interface HeroSlideOverlay {
  position: OverlayPosition;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
}

interface HeroSlide {
  id: string;
  imageDesktop: { url: string; alt: string };
  imageMobile: { url: string; alt: string };
  link?: { url: string; openInNewTab: boolean };
  title?: string;
  overlay?: HeroSlideOverlay;
}

interface HeroCardStyle {
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

const SECTION_CLASS_FALLBACK = "mb-12 xl:mb-14 pt-1";

const DEFAULT_OVERLAY: HeroSlideOverlay = {
  position: "bottom",
  textColor: "#ffffff",
  backgroundColor: "#0f172a",
  backgroundOpacity: 0.65
};

const withOverlayDefaults = (overlay?: HeroSlideOverlay): HeroSlideOverlay => ({
  ...DEFAULT_OVERLAY,
  ...(overlay || {})
});

const normalizeSlide = (slide: HeroSlide): HeroSlide => ({
  ...slide,
  overlay: withOverlayDefaults(slide.overlay)
});

interface HeroCarouselSettingsProps {
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

export function HeroCarouselSettings({ blockId, config, onSave }: HeroCarouselSettingsProps) {
  // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const defaultCardStyle: HeroCardStyle = {
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

  const [slides, setSlides] = useState<HeroSlide[]>(() =>
    (config.slides || []).map(normalizeSlide)
  );
  const [breakpointMode, setBreakpointMode] = useState<"simplified" | "advanced">(
    config.breakpointMode || "simplified"
  );
  const [itemsToShow, setItemsToShow] = useState({
    desktop: config.itemsToShow?.desktop || 2,
    tablet: config.itemsToShow?.tablet || 2,
    mobile: config.itemsToShow?.mobile || 1
  });
  const [breakpointsJSON, setBreakpointsJSON] = useState(
    JSON.stringify(config.breakpointsJSON || {
      "1536": { slidesPerView: 2, spaceBetween: 20 },
      "1280": { slidesPerView: 2, spaceBetween: 16 },
      "1024": { slidesPerView: 2, spaceBetween: 16 },
      "768": { slidesPerView: 2, spaceBetween: 16 },
      "520": { slidesPerView: 2, spaceBetween: 12 },
      "0": { slidesPerView: 1, spaceBetween: 5 }
    }, null, 2)
  );
  const [autoplay, setAutoplay] = useState(config.autoplay ?? true);
  const [autoplaySpeed, setAutoplaySpeed] = useState(config.autoplaySpeed || 5000);
  const [loop, setLoop] = useState(config.loop ?? true);
  const [showDots, setShowDots] = useState(config.showDots ?? true);
  const [showArrows, setShowArrows] = useState(config.showArrows ?? true);
  const [cardStyle, setCardStyle] = useState<HeroCardStyle>({
    ...defaultCardStyle,
    ...(config.cardStyle || {})
  });
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState(config.title || "");
  const [sectionClassName, setSectionClassName] = useState(
    config.className || SECTION_CLASS_FALLBACK
  );

  const addSlide = () => {
    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      imageDesktop: { url: "", alt: "" },
      imageMobile: { url: "", alt: "" },
      link: { url: "", openInNewTab: false },
      title: "",
      overlay: { ...DEFAULT_OVERLAY }
    };
    setSlides((prev) => [...prev, newSlide]);
  };

  const removeSlide = (index: number) => {
    setSlides(slides.filter((_, i) => i !== index));
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === slides.length - 1)
    ) {
      return;
    }

    const newSlides = [...slides];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    setSlides(newSlides);
  };

  const updateSlide = (index: number, field: keyof HeroSlide, value: any) => {
    const newSlides = [...slides];
    if (field === "link") {
      newSlides[index] = { ...newSlides[index], link: value };
    } else if (field === "overlay") {
      newSlides[index] = { ...newSlides[index], overlay: withOverlayDefaults(value) };
    } else {
      newSlides[index] = { ...newSlides[index], [field]: value };
    }
    setSlides(newSlides);
  };

  const updateCardStyleField = <K extends keyof HeroCardStyle>(field: K, value: HeroCardStyle[K]) => {
    setCardStyle((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateOverlayField = <K extends keyof HeroSlideOverlay>(
    index: number,
    field: K,
    value: HeroSlideOverlay[K]
  ) => {
    const existing = withOverlayDefaults(slides[index]?.overlay);
    updateSlide(index, "overlay", {
      ...existing,
      [field]: value
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
      const normalizedSlides = slides.map(normalizeSlide);
      const trimmedTitle = sectionTitle.trim();
      const baseConfig: any = {
        title: trimmedTitle,
        slides: normalizedSlides,
        breakpointMode,
        autoplay,
        autoplaySpeed,
        loop,
        showDots,
        showArrows,
        cardStyle,
        className: sectionClassName?.trim() || SECTION_CLASS_FALLBACK
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
  }, [
    slides, sectionTitle, breakpointMode, autoplay, autoplaySpeed, loop,
    showDots, showArrows, cardStyle, sectionClassName, itemsToShow, breakpointsJSON,
    config.breakpointsJSON
  ]);

  return (
    <div className="space-y-6">
      {/* Section Wrapper Controls */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Section title (optional)</Label>
          <Input
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value)}
            placeholder="e.g. Campaign spotlight"
          />
          <p className="text-xs text-slate-500">
            When filled, the storefront shows a section heading above the carousel. Leave blank to hide it.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Container Tailwind classes</Label>
          <Input
            value={sectionClassName}
            onChange={(event) => setSectionClassName(event.target.value)}
            placeholder={SECTION_CLASS_FALLBACK}
          />
          <p className="text-xs text-slate-500">
            These classes wrap the whole block (background, padding, borders). Example:{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              bg-amber-50 border border-amber-200 rounded-2xl px-6 py-10
            </code>{" "}
            reproduces the yellow highlight shown in the builder.
          </p>
        </div>
      </div>

      {/* Slides Management */}
      <div>
        <div className="mb-3">
          <Label className="text-base font-semibold">Hero Slides</Label>
        </div>

        <div className="space-y-4">
          {slides.length === 0 ? (
            <p className="text-sm text-gray-500">No slides added yet. Click &quot;Add Slide&quot; to get started.</p>
          ) : (
            slides.map((slide, index) => {
              const overlay = slide.overlay ?? DEFAULT_OVERLAY;
              return (
              <div key={slide.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Slide {index + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveSlide(index, "up")}
                      disabled={index === 0}
                    >
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveSlide(index, "down")}
                      disabled={index === slides.length - 1}
                    >
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSlide(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Desktop Image */}
                  <ImageUploadField
                    label="Desktop Image URL (Recommended: 1920x600px)"
                    value={slide.imageDesktop.url}
                    onChange={(url) =>
                      updateSlide(index, "imageDesktop", { ...slide.imageDesktop, url })
                    }
                    placeholder="https://example.com/hero-desktop.jpg"
                  />

                  {/* Mobile Image */}
                  <ImageUploadField
                    label="Mobile Image URL (Recommended: 768x800px)"
                    value={slide.imageMobile.url}
                    onChange={(url) =>
                      updateSlide(index, "imageMobile", { ...slide.imageMobile, url })
                    }
                    placeholder="https://example.com/hero-mobile.jpg"
                  />

                  {/* Alt Text */}
                  <div>
                    <Label className="text-xs">Alt Text</Label>
                    <Input
                      type="text"
                      value={slide.imageDesktop.alt}
                      onChange={(e) => {
                        updateSlide(index, "imageDesktop", { ...slide.imageDesktop, alt: e.target.value });
                        updateSlide(index, "imageMobile", { ...slide.imageMobile, alt: e.target.value });
                      }}
                      placeholder="Describe the image"
                      className="mt-1"
                    />
                  </div>

                  {/* Link */}
                  <div>
                    <Label className="text-xs">Link URL (optional)</Label>
                    <Input
                      type="text"
                      value={slide.link?.url || ""}
                      onChange={(e) =>
                        updateSlide(index, "link", {
                          url: e.target.value,
                          openInNewTab: slide.link?.openInNewTab || false
                        })
                      }
                      placeholder="https://example.com/product"
                      className="mt-1"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`openInNewTab-${index}`}
                        checked={slide.link?.openInNewTab || false}
                        onChange={(e) =>
                          updateSlide(index, "link", {
                            url: slide.link?.url || "",
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

                  {/* Title & Description */}
                  <div>
                    <Label className="text-xs">Title (optional)</Label>
                    <Input
                      type="text"
                      value={slide.title || ""}
                      onChange={(e) => updateSlide(index, "title", e.target.value)}
                      placeholder="Hero title"
                      className="mt-1"
                    />
                  </div>
                  <div className="rounded-lg border border-white bg-white/70 p-3">
                    <div className="mb-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Title overlay
                      </Label>
                      <p className="text-[0.7rem] text-slate-500">
                        Choose whether the title appears at the top, middle, or bottom of the media and control the overlay colors/opacity.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-[11px] font-semibold uppercase text-slate-500">
                          Position
                        </Label>
                        <select
                          value={overlay.position}
                          onChange={(event) =>
                            updateOverlayField(index, "position", event.target.value as OverlayPosition)
                          }
                          className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700"
                        >
                          <option value="top">Top</option>
                          <option value="middle">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold uppercase text-slate-500">
                          Text color
                        </Label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            value={overlay.textColor}
                            onChange={(event) => updateOverlayField(index, "textColor", event.target.value)}
                            className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                          />
                          <Input
                            value={overlay.textColor}
                            onChange={(event) => updateOverlayField(index, "textColor", event.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold uppercase text-slate-500">
                          Background color
                        </Label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            value={overlay.backgroundColor}
                            onChange={(event) =>
                              updateOverlayField(index, "backgroundColor", event.target.value)
                            }
                            className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                          />
                          <Input
                            value={overlay.backgroundColor}
                            onChange={(event) =>
                              updateOverlayField(index, "backgroundColor", event.target.value)
                            }
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold uppercase text-slate-500">
                          Background opacity ({Math.round((overlay.backgroundOpacity ?? 0.65) * 100)}%)
                        </Label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((overlay.backgroundOpacity ?? 0.65) * 100)}
                          onChange={(event) =>
                            updateOverlayField(index, "backgroundOpacity", Number(event.target.value) / 100)
                          }
                          className="mt-3 w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </div>

        <Button type="button" onClick={addSlide} size="sm" variant="outline" className="mt-4">
          <Plus className="mr-1 h-4 w-4" /> Add Slide
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
              onChange={(event) => {
                const inputValue = event.target.value;
                setItemsToShow((prev) => {
                  const parsed = Number.parseFloat(inputValue);
                  return { ...prev, desktop: Number.isNaN(parsed) ? prev.desktop : parsed };
                });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tablet (≥768px)</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.tablet}
              onChange={(event) => {
                const inputValue = event.target.value;
                setItemsToShow((prev) => {
                  const parsed = Number.parseFloat(inputValue);
                  return { ...prev, tablet: Number.isNaN(parsed) ? prev.tablet : parsed };
                });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Mobile (&lt;768px)</Label>
            <Input
              type="number"
              step="0.5"
              value={itemsToShow.mobile}
              onChange={(event) => {
                const inputValue = event.target.value;
                setItemsToShow((prev) => {
                  const parsed = Number.parseFloat(inputValue);
                  return { ...prev, mobile: Number.isNaN(parsed) ? prev.mobile : parsed };
                });
              }}
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
            rows={8}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-sm"
            placeholder={`{
  "1536": { "slidesPerView": 2, "spaceBetween": 20 },
  "0": { "slidesPerView": 1, "spaceBetween": 5 }
}`}
          />
        </div>
      )}

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
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showDots}
              onChange={(e) => setShowDots(e.target.checked)}
            />
            Show dots
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(e) => setShowArrows(e.target.checked)}
            />
            Show arrows
          </label>
      </div>

       {autoplay && (
         <div>
            <Label className="text-xs uppercase tracking-wide text-slate-500">
              Autoplay speed (ms)
            </Label>
            <Input
              type="number"
              value={autoplaySpeed}
              onChange={(event) => {
                const inputValue = event.target.value;
                setAutoplaySpeed((prev: number) => {
                  const parsed = Number.parseInt(inputValue, 10);
                  return Number.isNaN(parsed) ? prev : parsed;
                });
              }}
              className="mt-2"
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setIsStyleOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700"
        >
          <span>Slide styling</span>
          <span className="text-xs text-slate-400">{isStyleOpen ? "Hide" : "Show"}</span>
        </button>
        {isStyleOpen ? (
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
                onChange={(e) => updateCardStyleField("borderWidth", Number(e.target.value))}
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
                    onChange={(e) => updateCardStyleField("borderColor", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                  />
                  <Input
                    value={cardStyle.borderColor}
                    onChange={(e) => updateCardStyleField("borderColor", e.target.value)}
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
                    onChange={(e) => updateCardStyleField("backgroundColor", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                  />
                  <Input
                    value={cardStyle.backgroundColor}
                    onChange={(e) => updateCardStyleField("backgroundColor", e.target.value)}
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
                  onChange={(e) =>
                    updateCardStyleField("borderStyle", e.target.value as HeroCardStyle["borderStyle"])
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
                  onChange={(e) =>
                    updateCardStyleField("borderRadius", e.target.value as HeroCardStyle["borderRadius"])
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
                  onChange={(e) =>
                    updateCardStyleField("shadowSize", e.target.value as HeroCardStyle["shadowSize"])
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
                  onChange={(e) => updateCardStyleField("shadowColor", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-700">Hover effect</Label>
              <select
                value={cardStyle.hoverEffect}
                onChange={(e) =>
                  updateCardStyleField("hoverEffect", e.target.value as HeroCardStyle["hoverEffect"])
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
                  onChange={(e) => updateCardStyleField("hoverScale", Number(e.target.value))}
                  className="w-full"
                />
              </div>
            ) : null}

            {["shadow", "glow"].includes(cardStyle.hoverEffect) ? (
              <div>
                <Label className="text-xs font-medium text-slate-700">Hover shadow size</Label>
                <select
                  value={cardStyle.hoverShadowSize ?? "lg"}
                  onChange={(e) =>
                    updateCardStyleField("hoverShadowSize", e.target.value as HeroCardStyle["hoverShadowSize"])
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
                  onChange={(e) => updateCardStyleField("hoverBackgroundColor", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                />
                <Input
                  value={cardStyle.hoverBackgroundColor || ""}
                  placeholder="Optional hex color"
                  onChange={(e) => updateCardStyleField("hoverBackgroundColor", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
