"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Check, Package } from "lucide-react";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { FullScreenModal } from "@/components/shared/FullScreenModal";
import { ProductFilterSection, type ProductFilterState, EMPTY_FILTERS } from "@/components/pim/ProductFilterSection";

type Product = {
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  images?: { url: string }[];
  status: string;
  brand?: { name?: Record<string, string> };
  category?: { name?: Record<string, string> };
};

type FilterState = ProductFilterState;

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entityCodes: string[]) => void;
  excludeEntityCodes?: string[];
  title?: string;
  description?: string;
  selectButtonText?: string;
  multiSelect?: boolean;
}

export function ProductSearchModal({
  isOpen,
  onClose,
  onSelect,
  excludeEntityCodes = [],
  title = "Select Products",
  description = "Search and select products",
  selectButtonText = "Add Selected",
  multiSelect = true,
}: ProductSearchModalProps) {
  const { languages } = useLanguageStore();
  const defaultLanguage = languages.find((lang) => lang.isDefault) || languages.find((lang) => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectingAll, setSelectingAll] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });

  const excludeSet = new Set(excludeEntityCodes);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFilters({ ...EMPTY_FILTERS });
      setProducts([]);
      setSelected(new Set());
      setPage(1);
      setTotalProducts(0);
    }
  }, [isOpen]);

  // Build query params from filters
  const buildQueryParams = useCallback((pageNum: number = 1, limit: number = 30) => {
    const params = new URLSearchParams();
    params.set("page", pageNum.toString());
    params.set("limit", limit.toString());

    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.status) params.set("status", filters.status);
    if (filters.product_kind) params.set("product_kind", filters.product_kind);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    if (filters.batch_id) params.set("batch_id", filters.batch_id);
    if (filters.entity_code) params.set("entity_code", filters.entity_code);
    if (filters.sku) {
      params.set("sku", filters.sku);
      params.set("sku_match", filters.sku_match);
    }
    if (filters.parent_sku) {
      params.set("parent_sku", filters.parent_sku);
      params.set("parent_sku_match", filters.parent_sku_match);
    }
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.category) params.set("category", filters.category);
    if (filters.product_type) params.set("product_type", filters.product_type);
    if (filters.price_min) params.set("price_min", filters.price_min);
    if (filters.price_max) params.set("price_max", filters.price_max);
    if (filters.score_min) params.set("score_min", filters.score_min);
    if (filters.score_max) params.set("score_max", filters.score_max);

    return params;
  }, [filters]);

  // Check if any filter is active
  const hasActiveFilters = filters.search.length >= 2 || filters.status || filters.product_kind ||
    filters.date_from || filters.date_to || filters.batch_id || filters.entity_code ||
    filters.sku || filters.parent_sku || filters.brand || filters.category ||
    filters.product_type || filters.price_min || filters.price_max || filters.score_min || filters.score_max;

  // Search products
  const searchProducts = useCallback(async (pageNum: number = 1) => {
    if (!hasActiveFilters) {
      if (pageNum === 1) {
        setProducts([]);
        setTotalProducts(0);
      }
      return;
    }

    setLoading(true);
    try {
      const params = buildQueryParams(pageNum, 30);
      const res = await fetch(`/api/b2b/pim/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const allProducts = data.products || [];

        if (pageNum === 1) {
          setProducts(allProducts);
        } else {
          setProducts((prev) => [...prev, ...allProducts]);
        }
        setTotalProducts(data.pagination?.total || allProducts.length);
      }
    } catch (error) {
      console.error("Failed to search products:", error);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, hasActiveFilters]);

  // Update filters with debounce for search
  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    setPage(1);
  };

  // Effect to trigger search when filters change
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (hasActiveFilters) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts(1);
      }, 300);
    } else {
      setProducts([]);
      setTotalProducts(0);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [filters, hasActiveFilters]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hasActiveFilters) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchProducts(1);
    }
  };

  // Toggle product selection
  const toggleProduct = (entityCode: string) => {
    if (multiSelect) {
      const newSet = new Set(selected);
      if (newSet.has(entityCode)) {
        newSet.delete(entityCode);
      } else {
        newSet.add(entityCode);
      }
      setSelected(newSet);
    } else {
      setSelected(new Set([entityCode]));
    }
  };

  // Select all visible products (excluding already associated)
  const selectAllVisible = () => {
    const newSet = new Set(selected);
    products.forEach(p => {
      if (!excludeSet.has(p.entity_code)) {
        newSet.add(p.entity_code);
      }
    });
    setSelected(newSet);
  };

  // Select all products (including not visible) - fetches all matching products
  const selectAll = async () => {
    if (!hasActiveFilters) return;

    setSelectingAll(true);
    try {
      // Fetch all matching products (up to 1000)
      const params = buildQueryParams(1, 1000);
      const res = await fetch(`/api/b2b/pim/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const allProducts = data.products || [];
        const newSet = new Set(selected);
        allProducts.forEach((p: Product) => {
          if (!excludeSet.has(p.entity_code)) {
            newSet.add(p.entity_code);
          }
        });
        setSelected(newSet);
      }
    } catch (error) {
      console.error("Failed to select all products:", error);
    } finally {
      setSelectingAll(false);
    }
  };

  // Get localized product name
  const getProductName = (product: Product): string => {
    if (typeof product.name === "string") return product.name;
    return product.name?.[defaultLanguageCode] || product.name?.it || product.name?.en || Object.values(product.name)[0] || "";
  };

  // Get localized brand name
  const getBrandName = (product: Product): string => {
    if (!product.brand?.name) return "";
    return product.brand.name[defaultLanguageCode] || product.brand.name.it || product.brand.name.en || Object.values(product.brand.name)[0] || "";
  };

  // Handle selection confirm
  const handleConfirm = () => {
    onSelect(Array.from(selected));
    onClose();
  };

  // Load more products
  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchProducts(nextPage);
  };

  const hasMore = products.length < totalProducts;
  const selectableProducts = products.filter(p => !excludeSet.has(p.entity_code));
  const selectableCount = selectableProducts.length;
  const notVisibleCount = totalProducts - products.length;

  return (
    <FullScreenModal
      open={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-[1280px]"
      actions={
        <>
          <span className="text-sm text-muted-foreground mr-2">
            {selected.size} product(s) selected
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-sm text-muted-foreground hover:text-foreground transition mr-2"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {selectButtonText} {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        {/* Search & Filters */}
        <ProductFilterSection
          filters={filters}
          onFiltersChange={updateFilters}
          onKeyDown={handleKeyDown}
          autoFocusSearch
          showHint
        />

        {/* Results Header with Select All */}
        {products.length > 0 && multiSelect && (
          <div className="py-2 px-4 border border-border rounded-lg bg-muted/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {products.length} of {totalProducts} products
              {selectableCount < products.length && (
                <span className="ml-1">({products.length - selectableCount} already added)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {selectableCount > 0 && (
                <button
                  onClick={selectAllVisible}
                  className="text-sm text-primary hover:underline"
                >
                  Select visible ({selectableCount})
                </button>
              )}
              {notVisibleCount > 0 && selectableCount > 0 && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={selectAll}
                    disabled={selectingAll}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    {selectingAll ? "Loading..." : `Select all (${totalProducts})`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="rounded-lg border border-border">
          {loading && products.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                <span className="text-sm text-muted-foreground">Searching products...</span>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-1">
                {hasActiveFilters ? "No products found" : "Search for products"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {hasActiveFilters
                  ? "Try different search terms or filters."
                  : "Enter a product name, entity code, or SKU to find products."}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {products.map((product) => {
                  const isExcluded = excludeSet.has(product.entity_code);
                  const isSelected = selected.has(product.entity_code);
                  const brandName = getBrandName(product);
                  return (
                    <div
                      key={product.entity_code}
                      onClick={() => !isExcluded && toggleProduct(product.entity_code)}
                      className={`flex items-center gap-4 px-6 py-3 transition ${
                        isExcluded
                          ? "bg-muted/30 opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "bg-primary/5 cursor-pointer"
                          : "hover:bg-muted/50 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isExcluded || isSelected}
                        disabled={isExcluded}
                        onChange={() => {}}
                        className={`h-4 w-4 rounded border-border focus:ring-primary ${
                          isExcluded ? "text-muted-foreground" : "text-primary"
                        }`}
                      />
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {getProductName(product)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.entity_code}
                          {product.sku && ` | ${product.sku}`}
                          {brandName && ` | ${brandName}`}
                        </div>
                      </div>
                      {isExcluded ? (
                        <span className="text-xs text-muted-foreground flex-shrink-0 bg-muted px-2 py-1 rounded">
                          Already added
                        </span>
                      ) : isSelected ? (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center py-4 border-t border-border">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm disabled:opacity-50"
                  >
                    {loading ? "Loading..." : `Load more (${products.length} of ${totalProducts})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </FullScreenModal>
  );
}
