"use client";

import { ChevronLeft, ChevronRight, Percent, Star } from "lucide-react";
import { useMemo, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProductBlockConfig } from "@/lib/types/blocks";
import { getMockProducts } from "@/lib/data/mockCatalog";

interface ProductSectionProps {
  config: ProductBlockConfig;
}

const scrollBy = (container: HTMLDivElement | null, delta: number) => {
  container?.scrollBy({ left: delta, behavior: "smooth" });
};

const ProductCard = ({
  name,
  price,
  compareAt,
  image,
  rating
}: {
  name: string;
  price: number;
  compareAt?: number;
  image: string;
  rating?: number;
}) => (
  <Card className="w-[240px] overflow-hidden rounded-2xl shadow-sm transition hover:shadow-md md:w-[260px]">
    <div className="relative">
      <Image src={image} alt={name} width={640} height={480} className="h-48 w-full object-cover" sizes="260px" />
      {compareAt ? (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground shadow">
          <Percent size={14} /> Sale
        </div>
      ) : null}
    </div>
    <CardContent className="p-3">
      <div className="min-h-[2.5rem] text-sm font-medium line-clamp-2">{name}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-base font-semibold">€{price.toFixed(2)}</div>
        {compareAt ? <div className="text-sm text-muted-foreground line-through">€{compareAt.toFixed(2)}</div> : null}
      </div>
      <div className="mt-2 flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Star key={idx} size={14} className={rating && idx < Math.round(rating) ? "fill-current" : ""} />
        ))}
      </div>
      <div className="mt-3">
        <Button className="w-full rounded-xl" size="sm">
          Add to cart
        </Button>
      </div>
    </CardContent>
  </Card>
);

const SliderLayout = ({ config }: { config: Extract<ProductBlockConfig, { variant: "slider" }> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const products = useMemo(
    () => getMockProducts(config.collection, config.limit),
    [config.collection, config.limit]
  );

  return (
    <div className="relative">
      <button
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-2 shadow md:flex"
        onClick={() => scrollBy(containerRef.current, -320)}
        aria-label="Scroll products left"
      >
        <ChevronLeft />
      </button>
      <div
        ref={containerRef}
        className="no-scrollbar flex gap-4 overflow-x-auto px-2 py-2 scroll-smooth md:px-8"
      >
        {products.map((product) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>
      <button
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-2 shadow md:flex"
        onClick={() => scrollBy(containerRef.current, 320)}
        aria-label="Scroll products right"
      >
        <ChevronRight />
      </button>
    </div>
  );
};

const GridLayout = ({ config }: { config: Extract<ProductBlockConfig, { variant: "grid" }> }) => {
  const products = useMemo(
    () => getMockProducts(config.collection, config.limit),
    [config.collection, config.limit]
  );
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

  const desktopClass = desktopCols[config.columns.desktop as keyof typeof desktopCols] ?? "md:grid-cols-3";
  const tabletClass = tabletCols[config.columns.tablet as keyof typeof tabletCols] ?? "sm:grid-cols-2";

  return (
    <div className={`grid gap-4 ${tabletClass} ${desktopClass}`}>
      {products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
};

export const ProductSection = ({ config }: ProductSectionProps) => {
  return (
    <section className="space-y-4">
      {config.title ? <h2 className="text-xl font-semibold md:text-2xl">{config.title}</h2> : null}
      {config.subtitle ? <p className="text-muted-foreground">{config.subtitle}</p> : null}
      {config.variant === "slider" ? <SliderLayout config={config} /> : <GridLayout config={config} />}
    </section>
  );
};
