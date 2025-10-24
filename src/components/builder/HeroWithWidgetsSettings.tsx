"use client";

import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Upload, MoveUp, MoveDown } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";

interface HeroSlide {
  id: string;
  imageDesktop: { url: string; alt: string };
  imageMobile: { url: string; alt: string };
  link?: { url: string; openInNewTab: boolean };
  title?: string;
  description?: string;
}

interface HeroWithWidgetsSettingsProps {
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

export function HeroWithWidgetsSettings({ blockId, config, onSave }: HeroWithWidgetsSettingsProps) {
  const [slides, setSlides] = useState<HeroSlide[]>(config.slides || []);
  const [autoplay, setAutoplay] = useState(config.autoplay ?? true);
  const [autoplaySpeed, setAutoplaySpeed] = useState(config.autoplaySpeed || 5000);
  const [loop, setLoop] = useState(config.loop ?? true);
  const [showDots, setShowDots] = useState(config.showDots ?? true);
  const [showArrows, setShowArrows] = useState(config.showArrows ?? true);

  // Widget settings
  const [clockEnabled, setClockEnabled] = useState(config.widgets?.clock?.enabled ?? true);
  const [clockTimezone, setClockTimezone] = useState(config.widgets?.clock?.timezone || "Europe/Rome");
  const [showWeather, setShowWeather] = useState(config.widgets?.clock?.showWeather ?? true);
  const [weatherLocation, setWeatherLocation] = useState(config.widgets?.clock?.weatherLocation || "Paris");
  const [calendarEnabled, setCalendarEnabled] = useState(config.widgets?.calendar?.enabled ?? true);
  const [highlightToday, setHighlightToday] = useState(config.widgets?.calendar?.highlightToday ?? true);

  const addSlide = () => {
    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      imageDesktop: { url: "", alt: "" },
      imageMobile: { url: "", alt: "" },
      link: { url: "", openInNewTab: false },
      title: "",
      description: ""
    };
    setSlides([...slides, newSlide]);
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
    } else {
      newSlides[index] = { ...newSlides[index], [field]: value };
    }
    setSlides(newSlides);
  };

  const handleSave = () => {
    const finalConfig = {
      slides,
      autoplay,
      autoplaySpeed,
      loop,
      showDots,
      showArrows,
      widgets: {
        clock: {
          enabled: clockEnabled,
          timezone: clockTimezone,
          showWeather,
          weatherLocation
        },
        calendar: {
          enabled: calendarEnabled,
          highlightToday
        }
      },
      layout: {
        carouselWidth: "80%",
        widgetsWidth: "20%"
      },
      className: config.className || "hero-with-widgets-section"
    };

    onSave(finalConfig);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hero with Widgets Settings</h3>
        <Button onClick={handleSave} size="sm">
          Save
        </Button>
      </div>

      {/* Carousel Slides Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Carousel Slides (80% Left)</h4>
          <Button onClick={addSlide} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Slide
          </Button>
        </div>

        {slides.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">No slides yet. Click "Add Slide" to get started.</p>
          </div>
        )}

        {slides.map((slide, index) => (
          <div key={slide.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="font-medium">Slide {index + 1}</h5>
              <div className="flex gap-2">
                <Button
                  onClick={() => moveSlide(index, "up")}
                  disabled={index === 0}
                  size="sm"
                  variant="ghost"
                >
                  <MoveUp className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => moveSlide(index, "down")}
                  disabled={index === slides.length - 1}
                  size="sm"
                  variant="ghost"
                >
                  <MoveDown className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => removeSlide(index)}
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-50"
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
                  type="url"
                  value={slide.link?.url || ""}
                  onChange={(e) =>
                    updateSlide(index, "link", {
                      url: e.target.value,
                      openInNewTab: slide.link?.openInNewTab || false
                    })
                  }
                  placeholder="https://example.com/products"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Widget Settings Section */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium">Widget Settings (20% Right)</h4>

        {/* Clock Widget */}
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Clock Widget (Top)</Label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={clockEnabled}
                onChange={(e) => setClockEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          {clockEnabled && (
            <>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Input
                  type="text"
                  value={clockTimezone}
                  onChange={(e) => setClockTimezone(e.target.value)}
                  placeholder="Europe/Rome"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Weather</Label>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={showWeather}
                    onChange={(e) => setShowWeather(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              {showWeather && (
                <div>
                  <Label className="text-xs">Weather Location</Label>
                  <Input
                    type="text"
                    value={weatherLocation}
                    onChange={(e) => setWeatherLocation(e.target.value)}
                    placeholder="Paris"
                    className="mt-1"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Calendar Widget */}
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Calendar Widget (Bottom)</Label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={calendarEnabled}
                onChange={(e) => setCalendarEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          {calendarEnabled && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">Highlight Today</Label>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={highlightToday}
                  onChange={(e) => setHighlightToday(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Carousel Options */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium">Carousel Options</h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Autoplay</Label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Loop</Label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Dots</Label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={showDots}
                onChange={(e) => setShowDots(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Arrows</Label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={showArrows}
                onChange={(e) => setShowArrows(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>

        {autoplay && (
          <div>
            <Label className="text-xs">Autoplay Speed (ms)</Label>
            <Input
              type="number"
              value={autoplaySpeed}
              onChange={(e) => setAutoplaySpeed(Number(e.target.value))}
              min={1000}
              max={10000}
              step={500}
              className="mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
