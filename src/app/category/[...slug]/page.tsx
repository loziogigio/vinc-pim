"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockCatalog, type MockProduct } from "@/lib/data/mockCatalog";

// Category structure for navigation
const categoryStructure: Record<string, { name: string; subcategories?: Record<string, string> }> = {
  "hydronic-heating": {
    name: "Hydronic Heating",
    subcategories: {
      "boilers": "Boilers",
      "radiators": "Radiators",
      "pumps": "Pumps",
      "thermostats": "Thermostats"
    }
  },
  "bathroom-suites": {
    name: "Bathroom Suites",
    subcategories: {
      "toilets": "Toilets",
      "sinks": "Sinks",
      "showers": "Showers",
      "bathtubs": "Bathtubs"
    }
  },
  "kitchen-tapware": {
    name: "Kitchen Tapware",
    subcategories: {
      "mixer-taps": "Mixer Taps",
      "sink-taps": "Sink Taps",
      "filtered-taps": "Filtered Taps"
    }
  },
  "service-tools": {
    name: "Service Tools",
    subcategories: {
      "hand-tools": "Hand Tools",
      "power-tools": "Power Tools",
      "testing-equipment": "Testing Equipment"
    }
  },
  "water-heaters": {
    name: "Water Heaters",
    subcategories: {
      "electric": "Electric Heaters",
      "gas": "Gas Heaters",
      "solar": "Solar Heaters"
    }
  }
};

type CategoryPageProps = {
  params: Promise<{ slug: string[] }>;
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const [slugs, setSlugs] = useState<string[]>([]);

  // Resolve params on mount
  useMemo(() => {
    params.then((p) => {
      setSlugs(p.slug);
    });
  }, [params]);

  // Build breadcrumb trail
  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: "Home", href: "/" }];

    if (slugs.length > 0) {
      const [mainCategory, ...subCategories] = slugs;
      const categoryData = categoryStructure[mainCategory];

      if (categoryData) {
        crumbs.push({
          label: categoryData.name,
          href: `/category/${mainCategory}`
        });

        if (subCategories.length > 0 && categoryData.subcategories) {
          subCategories.forEach((subSlug, index) => {
            const subName = categoryData.subcategories?.[subSlug];
            if (subName) {
              const subPath = `/category/${mainCategory}/${subCategories.slice(0, index + 1).join("/")}`;
              crumbs.push({
                label: subName,
                href: subPath
              });
            }
          });
        }
      }
    }

    return crumbs;
  }, [slugs]);

  // Get category name
  const categoryName = useMemo(() => {
    if (slugs.length === 0) return "Products";

    const [mainCategory, ...subCategories] = slugs;
    const categoryData = categoryStructure[mainCategory];

    if (!categoryData) return "Products";

    if (subCategories.length > 0 && categoryData.subcategories) {
      const lastSubSlug = subCategories[subCategories.length - 1];
      return categoryData.subcategories[lastSubSlug] || categoryData.name;
    }

    return categoryData.name;
  }, [slugs]);

  // Filter products by category
  const categoryProducts = useMemo(() => {
    if (slugs.length === 0) return mockCatalog;

    const [mainCategory] = slugs;
    const categoryData = categoryStructure[mainCategory];

    if (!categoryData) return mockCatalog;

    return mockCatalog.filter((product) =>
      product.category?.toLowerCase().includes(categoryData.name.toLowerCase())
    );
  }, [slugs]);

  // Group products by brand for display sections
  const productSections = useMemo(() => {
    const sections: Record<string, MockProduct[]> = {};

    categoryProducts.forEach((product) => {
      const brand = product.brand || "Other Brands";
      if (!sections[brand]) {
        sections[brand] = [];
      }
      sections[brand].push(product);
    });

    return Object.entries(sections).map(([brand, products]) => ({
      title: `${brand} Products`,
      subtitle: `Premium ${categoryName.toLowerCase()} from ${brand}`,
      products: products.slice(0, 12) // Limit to 12 per section
    }));
  }, [categoryProducts, categoryName]);

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumbs Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-xs text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-2">
                  {index > 0 && <span>/</span>}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-primary transition">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
        {/* Hero Banner (optional) */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{categoryName}</h1>
          <p className="text-muted-foreground">
            Discover our premium selection of {categoryName.toLowerCase()} products
          </p>
        </div>

        {/* Product Sections with Horizontal Scroll */}
        {productSections.map((section, sectionIndex) => (
          <ProductRail
            key={sectionIndex}
            title={section.title}
            subtitle={section.subtitle}
            products={section.products}
            viewAllHref={`/search?category=${encodeURIComponent(categoryName)}&brand=${encodeURIComponent(section.title.split(' ')[0])}`}
          />
        ))}

        {/* Empty State */}
        {productSections.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center rounded-xl border bg-card p-12 text-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">No products found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We couldn't find any products in this category.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/search">Browse All Products</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ProductRailProps = {
  title: string;
  subtitle?: string;
  products: MockProduct[];
  viewAllHref?: string;
};

function ProductRail({ title, subtitle, products, viewAllHref }: ProductRailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!products.length) {
    return null;
  }

  const scrollBy = (delta: number) => {
    containerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground md:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Button variant="ghost" size="sm" asChild className="hidden md:flex">
              <Link href={viewAllHref}>
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollBy(-320)}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-foreground shadow hover:bg-muted transition"
              aria-label="Scroll products left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(320)}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-foreground shadow hover:bg-muted transition"
              aria-label="Scroll products right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Cards Rail */}
      <div
        ref={containerRef}
        className="no-scrollbar flex gap-4 overflow-x-auto pb-2 scroll-smooth"
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Mobile View All */}
      {viewAllHref && (
        <div className="md:hidden">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={viewAllHref}>
              View All {title}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function ProductCard({ product }: { product: MockProduct }) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : null;

  return (
    <div className="w-[220px] shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md md:w-[240px]">
      {/* Image */}
      <Link href={`/products/${product.slug}`} className="block relative">
        <Image
          src={product.image}
          alt={product.name}
          width={640}
          height={480}
          className="h-48 w-full object-cover"
          loading="lazy"
          sizes="(min-width: 1024px) 240px, (min-width: 768px) 220px, 70vw"
        />

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {discount && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
              -{discount}%
            </span>
          )}
          {product.badge && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
              {product.badge}
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsWishlisted(!isWishlisted);
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow transition hover:bg-white"
          aria-label="Add to wishlist"
        >
          <Heart
            className={`h-4 w-4 ${
              isWishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground"
            }`}
          />
        </button>
      </Link>

      {/* Content */}
      <div className="space-y-2 p-3">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs font-medium text-primary uppercase">{product.brand}</p>
        )}

        {/* Product Name */}
        <Link href={`/products/${product.slug}`}>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {product.rating && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="text-xs font-medium text-foreground">{product.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">(24)</span>
          </div>
        )}

        {/* Price */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground">
              €{product.price.toFixed(2)}
            </span>
            {product.compareAt && (
              <span className="text-xs text-muted-foreground line-through">
                €{product.compareAt.toFixed(2)}
              </span>
            )}
          </div>
          {discount && (
            <span className="text-xs font-medium text-red-600">
              Save €{(product.compareAt! - product.price).toFixed(2)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <Button size="sm" className="w-full rounded-lg font-semibold">
          Add to Cart
        </Button>
      </div>
    </div>
  );
}
