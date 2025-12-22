"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, X, Check, Package, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguageStore } from "@/lib/stores/languageStore";

type Product = {
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  images?: { url: string }[];
  status: string;
  brand?: { name?: Record<string, string> };
  category?: { name?: Record<string, string> };
};

type FilterState = {
  search: string;
  status: string;
  entity_code: string;
  sku: string;
  sku_match: "exact" | "starts" | "includes" | "ends";
  parent_sku: string;
  parent_sku_match: "exact" | "starts" | "includes" | "ends";
  brand: string;
  category: string;
};

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "",
    entity_code: "",
    sku: "",
    sku_match: "exact",
    parent_sku: "",
    parent_sku_match: "exact",
    brand: "",
    category: "",
  });

  const excludeSet = new Set(excludeEntityCodes);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFilters({
        search: "",
        status: "",
        entity_code: "",
        sku: "",
        sku_match: "exact",
        parent_sku: "",
        parent_sku_match: "exact",
        brand: "",
        category: "",
      });
      setProducts([]);
      setSelected(new Set());
      setPage(1);
      setTotalProducts(0);
      setShowAdvancedFilters(false);
    }
  }, [isOpen]);

  // Build query params from filters
  const buildQueryParams = useCallback((pageNum: number = 1, limit: number = 30) => {
    const params = new URLSearchParams();
    params.set("page", pageNum.toString());
    params.set("limit", limit.toString());

    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.status) params.set("status", filters.status);
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

    return params;
  }, [filters]);

  // Check if any filter is active
  const hasActiveFilters = filters.search.length >= 2 || filters.status || filters.entity_code ||
    filters.sku || filters.parent_sku || filters.brand || filters.category;

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

  if (!isOpen) return null;

  const hasMore = products.length < totalProducts;
  const selectableProducts = products.filter(p => !excludeSet.has(p.entity_code));
  const selectableCount = selectableProducts.length;
  const notVisibleCount = totalProducts - products.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-xl border border-border bg-card shadow-xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          {/* Main Search */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Search products by name, entity code, or SKU..."
                className="w-full pl-12 pr-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:outline-none text-base"
                autoFocus
              />
            </div>
            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Filter className="h-4 w-4" />
            Advanced Filters
            {showAdvancedFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="p-4 border border-border rounded-lg bg-muted/30">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Entity Code</label>
                  <input
                    type="text"
                    placeholder="Filter by entity code"
                    value={filters.entity_code}
                    onChange={(e) => updateFilters({ entity_code: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">SKU</label>
                  <div className="flex gap-2">
                    <select
                      value={filters.sku_match}
                      onChange={(e) => updateFilters({ sku_match: e.target.value as FilterState["sku_match"] })}
                      className="rounded border border-border bg-background px-2 py-2 text-xs"
                    >
                      <option value="exact">Exact</option>
                      <option value="starts">Starts with</option>
                      <option value="includes">Includes</option>
                      <option value="ends">Ends with</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Filter by SKU"
                      value={filters.sku}
                      onChange={(e) => updateFilters({ sku: e.target.value })}
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Parent SKU</label>
                  <div className="flex gap-2">
                    <select
                      value={filters.parent_sku_match}
                      onChange={(e) => updateFilters({ parent_sku_match: e.target.value as FilterState["parent_sku_match"] })}
                      className="rounded border border-border bg-background px-2 py-2 text-xs"
                    >
                      <option value="exact">Exact</option>
                      <option value="starts">Starts with</option>
                      <option value="includes">Includes</option>
                      <option value="ends">Ends with</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Filter by parent SKU"
                      value={filters.parent_sku}
                      onChange={(e) => updateFilters({ parent_sku: e.target.value })}
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="Filter by brand"
                    value={filters.brand}
                    onChange={(e) => updateFilters({ brand: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Filter by category"
                    value={filters.category}
                    onChange={(e) => updateFilters({ category: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Type at least 2 characters to search, or use advanced filters
          </p>
        </div>

        {/* Results Header with Select All */}
        {products.length > 0 && multiSelect && (
          <div className="px-6 py-2 border-b border-border bg-muted/20 flex items-center justify-between">
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
        <div className="flex-1 overflow-y-auto">
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
                <div className="flex justify-center pb-4">
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              {selected.size} product(s) selected
            </span>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectButtonText} {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
