"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef } from "react";
import Image from "next/image";
import type { CategoryBlockConfig } from "@/lib/types/blocks";
import { getMockCategories } from "@/lib/data/mockCatalog";

interface CategorySectionProps {
  config: CategoryBlockConfig;
}

const scroll = (container: HTMLDivElement | null, delta: number) =>
  container?.scrollBy({ left: delta, behavior: "smooth" });

const CategoryCard = ({
  name,
  image,
  link,
  productCount
}: {
  name: string;
  image?: string;
  link?: string;
  productCount?: number;
}) => (
  <article className="overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
    {image ? (
      <Image src={image} alt={name} width={320} height={200} className="h-36 w-full object-cover" sizes="240px" />
    ) : null}
    <div className="p-4 text-center">
      <h3 className="text-sm font-semibold">{name}</h3>
      {typeof productCount === "number" ? (
        <p className="mt-1 text-xs text-muted-foreground">{productCount} products</p>
      ) : null}
      {link ? (
        <a href={link} className="mt-2 inline-block text-xs font-medium text-primary">
          Explore
        </a>
      ) : null}
    </div>
  </article>
);

const GridLayout = ({ config }: { config: Extract<CategoryBlockConfig, { variant: "grid" }> }) => {
  const categories = useMemo(() => {
    if (config.categories.length) return config.categories;
    return getMockCategories().map((category) => ({ ...category, productCount: Math.floor(Math.random() * 40) + 1 }));
  }, [config.categories]);

  const desktopCols = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
    6: "md:grid-cols-6"
  } as const;

  const tabletCols = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4"
  } as const;

  const desktopClass = desktopCols[config.columns.desktop as keyof typeof desktopCols] ?? "md:grid-cols-4";
  const tabletClass = tabletCols[config.columns.tablet as keyof typeof tabletCols] ?? "sm:grid-cols-3";

  return (
    <div className={`grid gap-4 ${tabletClass} ${desktopClass}`}>
      {categories.map((category) => (
        <CategoryCard key={category.id} {...category} />
      ))}
    </div>
  );
};

const CarouselLayout = ({ config }: { config: Extract<CategoryBlockConfig, { variant: "carousel" }> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const categories = useMemo(() => {
    if (config.categories.length) return config.categories;
    return getMockCategories();
  }, [config.categories]);

  return (
    <div className="relative">
      <button
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-2 shadow md:flex"
        onClick={() => scroll(containerRef.current, -260)}
        aria-label="Scroll categories left"
      >
        <ChevronLeft />
      </button>
      <div
        ref={containerRef}
        className="no-scrollbar flex gap-4 overflow-x-auto px-2 py-2 scroll-smooth md:px-8"
      >
        {categories.map((category) => (
          <div key={category.id} className="w-[200px] flex-shrink-0">
            <CategoryCard {...category} />
          </div>
        ))}
      </div>
      <button
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-2 shadow md:flex"
        onClick={() => scroll(containerRef.current, 260)}
        aria-label="Scroll categories right"
      >
        <ChevronRight />
      </button>
    </div>
  );
};

export const CategorySection = ({ config }: CategorySectionProps) => (
  <section className="space-y-4">
    {config.title ? <h2 className="text-xl font-semibold md:text-2xl">{config.title}</h2> : null}
    {config.variant === "grid" ? <GridLayout config={config} /> : <CarouselLayout config={config} />}
  </section>
);
