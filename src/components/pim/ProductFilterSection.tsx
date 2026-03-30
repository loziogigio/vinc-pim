"use client";

import { useEffect, useState } from "react";
import { Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { AutocompleteInput } from "@/components/shared/AutocompleteInput";

export type ProductFilterState = {
  search: string;
  status: string;
  product_kind: string;
  date_from: string;
  date_to: string;
  // Advanced filters
  batch_id: string;
  entity_code: string;
  sku: string;
  sku_match: "exact" | "starts" | "includes" | "ends";
  parent_sku: string;
  parent_sku_match: "exact" | "starts" | "includes" | "ends";
  brand: string;
  category: string;
  product_type: string;
  price_min: string;
  price_max: string;
  score_min: string;
  score_max: string;
};

export const EMPTY_FILTERS: ProductFilterState = {
  search: "",
  status: "",
  product_kind: "",
  date_from: "",
  date_to: "",
  batch_id: "",
  entity_code: "",
  sku: "",
  sku_match: "exact",
  parent_sku: "",
  parent_sku_match: "exact",
  brand: "",
  category: "",
  product_type: "",
  price_min: "",
  price_max: "",
  score_min: "",
  score_max: "",
};

interface ProductFilterSectionProps {
  filters: ProductFilterState;
  onFiltersChange: (updates: Partial<ProductFilterState>) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocusSearch?: boolean;
  showHint?: boolean;
}

export function ProductFilterSection({
  filters,
  onFiltersChange,
  onKeyDown,
  autoFocusSearch = false,
  showHint = false,
}: ProductFilterSectionProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [productTypeSuggestions, setProductTypeSuggestions] = useState<string[]>([]);
  const [batchSuggestions, setBatchSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetchBrandSuggestions();
    fetchCategorySuggestions();
    fetchProductTypeSuggestions();
  }, []);

  async function fetchSuggestions(type: string, search: string = "") {
    try {
      const params = new URLSearchParams();
      params.set("type", type);
      if (search) params.set("search", search);
      const res = await fetch(`/api/b2b/pim/filters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data[type + "s"] || [];
      }
    } catch (error) {
      console.error(`Error fetching ${type} suggestions:`, error);
    }
    return [];
  }

  async function fetchBatchSuggestions(search: string = "") {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/b2b/pim/batches?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBatchSuggestions(data.batches || []);
      }
    } catch (error) {
      console.error("Error fetching batch suggestions:", error);
    }
  }

  async function fetchBrandSuggestions(search: string = "") {
    const results = await fetchSuggestions("brand", search);
    setBrandSuggestions(results);
  }

  async function fetchCategorySuggestions(search: string = "") {
    const results = await fetchSuggestions("category", search);
    setCategorySuggestions(results);
  }

  async function fetchProductTypeSuggestions(search: string = "") {
    const results = await fetchSuggestions("product_type", search);
    setProductTypeSuggestions(results);
  }

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm border border-border">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            onKeyDown={onKeyDown}
            placeholder="Search products by name, entity code, or SKU..."
            className="w-full rounded border border-border bg-background px-9 py-2 text-sm focus:border-primary focus:outline-none"
            autoFocus={autoFocusSearch}
          />
        </div>

        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ status: e.target.value })}
          className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        {/* Product Kind Filter */}
        <select
          value={filters.product_kind}
          onChange={(e) => onFiltersChange({ product_kind: e.target.value })}
          className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">All Kinds</option>
          <option value="standard">Standard</option>
          <option value="bookable">Bookable</option>
          <option value="service">Service</option>
        </select>
      </div>

      {/* Date Range Filter */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Updated From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => onFiltersChange({ date_from: e.target.value })}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Updated To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => onFiltersChange({ date_to: e.target.value })}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <div className="mt-3">
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
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="mt-3 p-4 border border-border rounded-lg bg-muted/30">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AutocompleteInput
              label="Batch ID"
              placeholder="Filter by batch ID"
              value={filters.batch_id}
              onChange={(v) => onFiltersChange({ batch_id: v })}
              onSearch={(v) => v.length > 0 && fetchBatchSuggestions(v)}
              suggestions={batchSuggestions}
              inputClassName="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
            />
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Entity Code</label>
              <input
                type="text"
                placeholder="Filter by entity code"
                value={filters.entity_code}
                onChange={(e) => onFiltersChange({ entity_code: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">SKU</label>
              <div className="flex gap-2">
                <select
                  value={filters.sku_match}
                  onChange={(e) => onFiltersChange({ sku_match: e.target.value as ProductFilterState["sku_match"] })}
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
                  onChange={(e) => onFiltersChange({ sku: e.target.value })}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Parent SKU</label>
              <div className="flex gap-2">
                <select
                  value={filters.parent_sku_match}
                  onChange={(e) => onFiltersChange({ parent_sku_match: e.target.value as ProductFilterState["parent_sku_match"] })}
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
                  onChange={(e) => onFiltersChange({ parent_sku: e.target.value })}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <AutocompleteInput
              label="Brand"
              placeholder="Filter by brand"
              value={filters.brand}
              onChange={(v) => onFiltersChange({ brand: v })}
              onSearch={(v) => v.length > 0 && fetchBrandSuggestions(v)}
              suggestions={brandSuggestions}
            />
            <AutocompleteInput
              label="Category"
              placeholder="Filter by category"
              value={filters.category}
              onChange={(v) => onFiltersChange({ category: v })}
              onSearch={(v) => v.length > 0 && fetchCategorySuggestions(v)}
              suggestions={categorySuggestions}
            />
            <AutocompleteInput
              label="Product Type"
              placeholder="Filter by product type"
              value={filters.product_type}
              onChange={(v) => onFiltersChange({ product_type: v })}
              onSearch={(v) => v.length > 0 && fetchProductTypeSuggestions(v)}
              suggestions={productTypeSuggestions}
            />
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Min Price</label>
              <input
                type="number"
                placeholder="0"
                value={filters.price_min}
                onChange={(e) => onFiltersChange({ price_min: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Price</label>
              <input
                type="number"
                placeholder="999999"
                value={filters.price_max}
                onChange={(e) => onFiltersChange({ price_max: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Min Score</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                max="100"
                value={filters.score_min}
                onChange={(e) => onFiltersChange({ score_min: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Score</label>
              <input
                type="number"
                placeholder="100"
                min="0"
                max="100"
                value={filters.score_max}
                onChange={(e) => onFiltersChange({ score_max: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {showHint && (
        <p className="mt-3 text-xs text-muted-foreground">
          Type at least 2 characters to search, or use advanced filters
        </p>
      )}
    </div>
  );
}
