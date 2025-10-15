"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ProductGalleryImage {
  src: string;
  alt: string;
}

interface ProductMediaGalleryProps {
  images: ProductGalleryImage[];
}

export const ProductMediaGallery = ({ images }: ProductMediaGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeImages = useMemo(() => images.filter((image) => image.src), [images]);

  if (!safeImages.length) {
    return null;
  }

  const activeImage = safeImages[activeIndex] ?? safeImages[0];
  const goToIndex = (nextIndex: number) => {
    const normalized = (nextIndex + safeImages.length) % safeImages.length;
    setActiveIndex(normalized);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[94px_1fr]">
      <div className="no-scrollbar flex gap-3 overflow-x-auto md:flex-col md:overflow-y-auto">
        {safeImages.map((image, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={`${image.src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition md:h-20 md:w-20 ${
                isActive ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"
              }`}
              aria-label={`View product image ${index + 1}`}
              aria-pressed={isActive}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={200}
                height={200}
                className="h-full w-full object-cover"
                sizes="(min-width: 768px) 90px, 96px"
              />
            </button>
          );
        })}
      </div>
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl border bg-muted">
        <Image
          src={activeImage.src}
          alt={activeImage.alt}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 560px, (min-width: 768px) 70vw, 100vw"
          priority
        />
        {safeImages.length > 1 ? (
          <>
            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-4">
              <button
                type="button"
                onClick={() => goToIndex(activeIndex - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-background/85 text-foreground shadow"
                aria-label="Previous product image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goToIndex(activeIndex + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-background/85 text-foreground shadow"
                aria-label="Next product image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {safeImages.map((_, index) => (
                <span
                  key={`dot-${index}`}
                  className={`h-2.5 w-2.5 rounded-full ${index === activeIndex ? "bg-primary" : "bg-white/60"}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

