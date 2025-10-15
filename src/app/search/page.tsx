"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Grid3x3,
  List,
  SlidersHorizontal,
  X,
  ChevronDown,
  Search,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockCatalog, type MockProduct } from "@/lib/data/mockCatalog";

type ViewMode = "grid" | "list";
type SortOption = "relevance" | "price-asc" | "price-desc" | "name" | "rating";

type FacetOption = {
  label: string;
  value: string;
  count: number;
};

type Facet = {
  id: string;
  label: string;
  options: FacetOption[];
  expanded: boolean;
};

export default function SearchPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    category: [],
    brand: [],
    priceRange: [],
    rating: []
  });

  // Generate facets from catalog
  const facets = useMemo<Facet[]>(() => {
    const categories = new Map<string, number>();
    const brands = new Map<string, number>();
    const ratings = new Map<string, number>();

    mockCatalog.forEach((product) => {
      // Categories
      const category = product.category || "Uncategorized";
      categories.set(category, (categories.get(category) || 0) + 1);

      // Brands
      const brand = product.brand || "Generic";
      brands.set(brand, (brands.get(brand) || 0) + 1);

      // Ratings
      const rating = Math.floor(product.rating || 0);
      const ratingLabel = `${rating}+ stars`;
      ratings.set(ratingLabel, (ratings.get(ratingLabel) || 0) + 1);
    });

    return [
      {
        id: "category",
        label: "Category",
        expanded: true,
        options: Array.from(categories.entries())
          .map(([value, count]) => ({ label: value, value, count }))
          .sort((a, b) => b.count - a.count)
      },
      {
        id: "brand",
        label: "Brand",
        expanded: true,
        options: Array.from(brands.entries())
          .map(([value, count]) => ({ label: value, value, count }))
          .sort((a, b) => b.count - a.count)
      },
      {
        id: "priceRange",
        label: "Price Range",
        expanded: true,
        options: [
          { label: "Under €50", value: "0-50", count: 0 },
          { label: "€50 - €100", value: "50-100", count: 0 },
          { label: "€100 - €200", value: "100-200", count: 0 },
          { label: "€200+", value: "200-999999", count: 0 }
        ]
      },
      {
        id: "rating",
        label: "Customer Rating",
        expanded: false,
        options: Array.from(ratings.entries())
          .map(([label, count]) => ({ label, value: label, count }))
          .sort((a, b) => b.value.localeCompare(a.value))
      }
    ];
  }, []);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let results = [...mockCatalog];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    Object.entries(selectedFilters).forEach(([facetId, values]) => {
      if (values.length === 0) return;

      results = results.filter((product) => {
        switch (facetId) {
          case "category":
            return values.includes(product.category || "Uncategorized");
          case "brand":
            return values.includes(product.brand || "Generic");
          case "priceRange":
            return values.some((range) => {
              const [min, max] = range.split("-").map(Number);
              return product.price >= min && product.price <= max;
            });
          case "rating":
            return values.some((ratingStr) => {
              const minRating = parseInt(ratingStr);
              return Math.floor(product.rating || 0) >= minRating;
            });
          default:
            return true;
        }
      });
    });

    // Apply sorting
    switch (sortBy) {
      case "price-asc":
        results.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        results.sort((a, b) => b.price - a.price);
        break;
      case "name":
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "rating":
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      default:
        // relevance - keep original order
        break;
    }

    return results;
  }, [searchQuery, selectedFilters, sortBy]);

  const toggleFilter = (facetId: string, value: string) => {
    setSelectedFilters((prev) => {
      const current = prev[facetId] || [];
      const newValues = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [facetId]: newValues };
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters({
      category: [],
      brand: [],
      priceRange: [],
      rating: []
    });
  };

  const activeFilterCount = Object.values(selectedFilters).flat().length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-3">
        {/* Breadcrumbs with results count */}
        <div className="flex items-center justify-between text-xs">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-primary transition">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li className="text-foreground">Search</li>
            </ol>
          </nav>
          <span className="text-muted-foreground">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Filters Sidebar */}
          <aside
            className={`lg:block ${
              showFilters ? "fixed inset-0 z-50 bg-background p-4 lg:relative lg:p-0" : "hidden"
            }`}
          >
            <div className="sticky top-24 space-y-4">
              {/* Mobile Filter Header */}
              <div className="flex items-center justify-between lg:hidden">
                <h2 className="text-lg font-semibold text-foreground">Filters</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                  className="lg:hidden"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border bg-card px-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Active Filters */}
              {activeFilterCount > 0 && (
                <div className="rounded-lg bg-muted p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Active Filters ({activeFilterCount})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedFilters).flatMap(([facetId, values]) =>
                      values.map((value) => (
                        <button
                          key={`${facetId}-${value}`}
                          onClick={() => toggleFilter(facetId, value)}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                        >
                          {value}
                          <X className="h-3 w-3" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Facets */}
              {facets.map((facet) => (
                <div key={facet.id} className="pb-4 border-b last:border-0">
                  <button
                    onClick={() => {
                      // Toggle facet expansion (you can add state for this if needed)
                    }}
                    className="flex w-full items-center justify-between text-sm font-semibold text-foreground mb-3"
                  >
                    {facet.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        facet.expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {facet.expanded && (
                    <div className="space-y-2">
                      {facet.options.map((option) => {
                        const isSelected = selectedFilters[facet.id]?.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2 text-sm hover:text-primary"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFilter(facet.id, option.value)}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                            />
                            <span className="flex-1 text-foreground">{option.label}</span>
                            <span className="text-xs text-muted-foreground">({option.count})</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
              <Button
                variant="outline"
                onClick={() => setShowFilters(true)}
                className="lg:hidden"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-lg border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                  <option value="rating">Rating</option>
                </select>
              </div>

              <div className="flex items-center gap-1 rounded-lg border p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8 p-0"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Products Grid/List */}
            {filteredProducts.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border bg-card p-12 text-center">
                <div>
                  <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">No products found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try adjusting your filters or search query
                  </p>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCardGrid key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((product) => (
                  <ProductCardList key={product.id} product={product} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ProductCardGrid({ product }: { product: MockProduct }) {
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md"
    >
      <div className="relative">
        <Image
          src={product.image}
          alt={product.name}
          width={400}
          height={300}
          className="h-48 w-full object-cover transition group-hover:scale-105"
        />
        {discount && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow">
            -{discount}%
          </span>
        )}
        {product.badge && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2 py-1 text-xs font-medium text-white shadow">
            {product.badge}
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{product.name}</p>
        {product.rating && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="text-xs text-muted-foreground">{product.rating.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">€{product.price.toFixed(2)}</span>
          {product.compareAt && (
            <span className="text-sm text-muted-foreground line-through">
              €{product.compareAt.toFixed(2)}
            </span>
          )}
        </div>
        <Button size="sm" className="w-full">
          View Details
        </Button>
      </div>
    </Link>
  );
}

function ProductCardList({ product }: { product: MockProduct }) {
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex gap-4 overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg">
        <Image
          src={product.image}
          alt={product.name}
          width={200}
          height={200}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        {discount && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow">
            -{discount}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground line-clamp-2">{product.name}</h3>
          {product.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{product.description}</p>
          )}
          {product.rating && (
            <div className="mt-2 flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="text-xs text-muted-foreground">{product.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">€{product.price.toFixed(2)}</span>
            {product.compareAt && (
              <span className="text-sm text-muted-foreground line-through">
                €{product.compareAt.toFixed(2)}
              </span>
            )}
          </div>
          <Button size="sm">View Details</Button>
        </div>
      </div>
    </Link>
  );
}
