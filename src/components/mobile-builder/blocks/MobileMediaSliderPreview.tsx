"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import type { MobileMediaSliderBlock } from "@/lib/types/mobile-builder";
import { cn } from "@/components/ui/utils";

interface MobileMediaSliderPreviewProps {
  block: MobileMediaSliderBlock;
}

// Sample data for preview
const SAMPLE_SLIDES = [
  { color: "bg-gradient-to-br from-pink-400 to-pink-600", label: "Banner 1" },
  { color: "bg-gradient-to-br from-purple-400 to-purple-600", label: "Banner 2" },
  { color: "bg-gradient-to-br from-blue-400 to-blue-600", label: "Banner 3" },
];

const ASPECT_RATIO_PADDING = {
  "16:9": "56.25%",
  "4:3": "75%",
  "1:1": "100%",
  "9:16": "177.78%",
};

export function MobileMediaSliderPreview({ block }: MobileMediaSliderPreviewProps) {
  const { autoplay, autoplay_interval, show_dots, show_arrows, aspect_ratio } = block.settings;
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = block.items.length > 0 ? block.items : SAMPLE_SLIDES.map((s, i) => ({
    media_url: "",
    media_type: "image" as const,
    alt_text: s.label,
    _sample: s,
  }));

  const totalSlides = slides.length;

  // Autoplay
  useEffect(() => {
    if (!autoplay || totalSlides <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, autoplay_interval);

    return () => clearInterval(timer);
  }, [autoplay, autoplay_interval, totalSlides]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const goNext = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const goPrev = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  return (
    <div className="relative w-full bg-white">
      {/* Slider container */}
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: ASPECT_RATIO_PADDING[aspect_ratio] }}
      >
        <div
          className="absolute inset-0 flex transition-transform duration-300"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div
              key={index}
              className="h-full w-full flex-shrink-0"
            >
              {slide.media_url ? (
                <img
                  src={slide.media_url}
                  alt={slide.alt_text || `Slide ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center",
                    (slide as any)._sample?.color || "bg-gray-200"
                  )}
                >
                  <div className="text-center text-white">
                    <ImageIcon className="mx-auto h-8 w-8 opacity-50" />
                    <span className="mt-2 block text-sm opacity-75">
                      {(slide as any)._sample?.label || `Slide ${index + 1}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Arrows */}
      {show_arrows && totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 shadow"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 shadow"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dots */}
      {show_dots && totalSlides > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                currentSlide === index ? "w-4 bg-white" : "bg-white/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
