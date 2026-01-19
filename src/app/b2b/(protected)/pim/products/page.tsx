"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BulkUpdateModal, BulkUpdateData } from "@/components/pim/BulkUpdateModal";
import { ProductImage, PIMProductListItem } from "@/lib/types/pim";
import { LanguageStatusBadge } from "@/components/pim/LanguageStatusBadge";
import { useLanguageStore } from "@/lib/stores/languageStore";
import {
  Search,
  Filter,
  Package,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Edit as EditIcon,
  Plus,
} from "lucide-react";

// Extend PIMProductListItem with page-specific fields
type Product = PIMProductListItem & {
  name: string | Record<string, string>; // Override to support multilingual
  description?: string | Record<string, string>;
  currency: string;
  brand?: { id: string; name: string | Record<string, string> };
  category?: { id: string; name: string | Record<string, string> };
  has_conflict?: boolean;
  source?: {
    source_id: string;
    source_name: string;
    batch_id?: string;
    imported_at: string;
  };
  updated_at: string;
  _available_languages?: string[];
  _language?: string;
};

type FilterState = {
  search: string;
  status: string;
  sort: string;
  batch_id: string;
  date_from: string;
  date_to: string;
  has_conflict: string;
  // Advanced filters
  brand: string;
  category: string;
  price_min: string;
  price_max: string;
  score_min: string;
  score_max: string;
  entity_code: string;
  sku: string;
  sku_match: "exact" | "starts" | "includes" | "ends";
  parent_sku: string;
  parent_sku_match: "exact" | "starts" | "includes" | "ends";
};

/**
 * Helper function to extract text from multilingual objects
 * Uses default language first, then fallback chain
 */
function getMultilingualText(
  text: string | Record<string, string> | undefined,
  defaultLanguageCode: string = "it",
  fallback: string = ""
): string {
  if (!text) return fallback;
  if (typeof text === "string") return text;

  // Try default language first, then English, then first available value, then fallback
  return text[defaultLanguageCode] || text.en || Object.values(text)[0] || fallback;
}

export default function ProductsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Extract tenant prefix from URL (e.g., "/dfl-eventi-it/b2b/pim/products" -> "/dfl-eventi-it")
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  // Language store for getting default language from database
  const { languages, fetchLanguages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [batchSuggestions, setBatchSuggestions] = useState<string[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState<FilterState>({
    search: searchParams?.get("search") || "",
    status: searchParams?.get("status") || "",
    sort: searchParams?.get("sort") || "priority",
    batch_id: searchParams?.get("batch_id") || "",
    date_from: searchParams?.get("date_from") || "",
    date_to: searchParams?.get("date_to") || "",
    has_conflict: searchParams?.get("has_conflict") || "",
    // Advanced filters
    brand: searchParams?.get("brand") || "",
    category: searchParams?.get("category") || "",
    price_min: searchParams?.get("price_min") || "",
    price_max: searchParams?.get("price_max") || "",
    score_min: searchParams?.get("score_min") || "",
    score_max: searchParams?.get("score_max") || "",
    entity_code: searchParams?.get("entity_code") || "",
    sku: searchParams?.get("sku") || "",
    sku_match: (searchParams?.get("sku_match") as FilterState["sku_match"]) || "exact",
    parent_sku: searchParams?.get("parent_sku") || "",
    parent_sku_match: (searchParams?.get("parent_sku_match") as FilterState["parent_sku_match"]) || "exact",
  });

  // Selection handlers
  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      // Deselect all
      setSelectedProducts(new Set());
    } else {
      // Select all products on current page
      setSelectedProducts(new Set(products.map((p) => p._id)));
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const exportSelectedProducts = async () => {
    if (selectedProducts.size === 0) return;

    try {
      const productIds = Array.from(selectedProducts);
      const res = await fetch("/api/b2b/pim/products/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_ids: productIds }),
      });

      if (res.ok) {
        // Download the CSV file
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const error = await res.json();
        alert(`Export failed: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error exporting products:", error);
      alert("Failed to export products. Please try again.");
    }
  };

  const handleBulkUpdate = async (updates: BulkUpdateData) => {
    try {
      const productIds = Array.from(selectedProducts);
      const res = await fetch("/api/b2b/pim/products/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_ids: productIds, updates }),
      });

      if (res.ok) {
        const data = await res.json();
        // Clear selection
        setSelectedProducts(new Set());
        // Redirect to jobs page to monitor progress
        router.push(`${tenantPrefix}/b2b/pim/jobs`);
      } else {
        const error = await res.json();
        alert(`Bulk update failed: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error bulk updating products:", error);
      alert("Failed to queue bulk update. Please try again.");
    }
  };

  const isAllSelected = products.length > 0 && selectedProducts.size === products.length;
  const isSomeSelected = selectedProducts.size > 0 && selectedProducts.size < products.length;

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  useEffect(() => {
    // Fetch languages from database on mount
    fetchLanguages();
    fetchBatchSuggestions();
    fetchBrandSuggestions();
    fetchCategorySuggestions();
  }, []);

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
    try {
      const params = new URLSearchParams();
      params.set("type", "brand");
      if (search) params.set("search", search);

      const res = await fetch(`/api/b2b/pim/filters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBrandSuggestions(data.brands || []);
      }
    } catch (error) {
      console.error("Error fetching brand suggestions:", error);
    }
  }

  async function fetchCategorySuggestions(search: string = "") {
    try {
      const params = new URLSearchParams();
      params.set("type", "category");
      if (search) params.set("search", search);

      const res = await fetch(`/api/b2b/pim/filters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCategorySuggestions(data.categorys || []);
      }
    } catch (error) {
      console.error("Error fetching category suggestions:", error);
    }
  }

  async function fetchProducts() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "50");

      // Add all filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "sort") {
          params.set(key, value);
        }
      });
      if (filters.sort) params.set("sort", filters.sort);

      const res = await fetch(`/api/b2b/pim/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilters(updates: Partial<FilterState>) {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("page", "1"); // Reset to first page

    router.push(`${tenantPrefix}/b2b/pim/products?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", page.toString());
    router.push(`${tenantPrefix}/b2b/pim/products?${params.toString()}`);
  }

  const renderEmptyState = () => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <Package className="mx-auto h-12 w-12 text-[#b9b9c3] mb-3" />
        <p className="text-[1.05rem] font-semibold">No products found</p>
        <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">
          {filters.search || filters.status
            ? "Try adjusting your filters"
            : "Import products to get started"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Products" },
        ]}
      />

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog ({pagination.total} total)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Product
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products by title..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full rounded border border-border bg-background px-9 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          {/* Conflict Filter */}
          <select
            value={filters.has_conflict}
            onChange={(e) => updateFilters({ has_conflict: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Items</option>
            <option value="true">Needs Merge</option>
            <option value="false">No Conflicts</option>
          </select>

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => updateFilters({ sort: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="priority">Priority (High to Low)</option>
            <option value="score">Score (Low to High)</option>
            <option value="updated">Recently Updated</option>
            <option value="name">Title (A-Z)</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Updated From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => updateFilters({ date_from: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Updated To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => updateFilters({ date_to: e.target.value })}
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
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Batch ID</label>
                <input
                  type="text"
                  placeholder="Filter by batch ID"
                  value={filters.batch_id}
                  onChange={(e) => {
                    updateFilters({ batch_id: e.target.value });
                    // Fetch suggestions as user types
                    if (e.target.value.length > 0) {
                      fetchBatchSuggestions(e.target.value);
                    }
                  }}
                  list="batch-suggestions"
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                />
                <datalist id="batch-suggestions">
                  {batchSuggestions.map((batch) => (
                    <option key={batch} value={batch} />
                  ))}
                </datalist>
              </div>
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
                  onChange={(e) => {
                    updateFilters({ brand: e.target.value });
                    // Fetch suggestions as user types
                    if (e.target.value.length > 0) {
                      fetchBrandSuggestions(e.target.value);
                    }
                  }}
                  list="brand-suggestions"
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <datalist id="brand-suggestions">
                  {brandSuggestions.map((brand) => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Category</label>
                <input
                  type="text"
                  placeholder="Filter by category"
                  value={filters.category}
                  onChange={(e) => {
                    updateFilters({ category: e.target.value });
                    // Fetch suggestions as user types
                    if (e.target.value.length > 0) {
                      fetchCategorySuggestions(e.target.value);
                    }
                  }}
                  list="category-suggestions"
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <datalist id="category-suggestions">
                  {categorySuggestions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Min Price</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.price_min}
                  onChange={(e) => updateFilters({ price_min: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Max Price</label>
                <input
                  type="number"
                  placeholder="999999"
                  value={filters.price_max}
                  onChange={(e) => updateFilters({ price_max: e.target.value })}
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
                  onChange={(e) => updateFilters({ score_min: e.target.value })}
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
                  onChange={(e) => updateFilters({ score_max: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {(filters.batch_id || filters.status || filters.search || filters.date_from || filters.date_to ||
          filters.has_conflict || filters.entity_code || filters.sku || filters.parent_sku || filters.brand || filters.category ||
          filters.price_min || filters.price_max || filters.score_min || filters.score_max) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {filters.batch_id && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span className="font-mono">Batch: {filters.batch_id}</span>
                <button
                  onClick={() => updateFilters({ batch_id: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.status && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Status: {filters.status}</span>
                <button
                  onClick={() => updateFilters({ status: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.has_conflict && (
              <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                <AlertTriangle className="h-3 w-3" />
                <span>{filters.has_conflict === "true" ? "Needs Merge" : "No Conflicts"}</span>
                <button
                  onClick={() => updateFilters({ has_conflict: "" })}
                  className="hover:bg-amber-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.search && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Search: &quot;{filters.search}&quot;</span>
                <button
                  onClick={() => updateFilters({ search: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(filters.date_from || filters.date_to) && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>
                  Date: {filters.date_from || "..."} to {filters.date_to || "..."}
                </span>
                <button
                  onClick={() => updateFilters({ date_from: "", date_to: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.entity_code && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Entity: {filters.entity_code}</span>
                <button
                  onClick={() => updateFilters({ entity_code: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.sku && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>SKU: {filters.sku} ({filters.sku_match})</span>
                <button
                  onClick={() => updateFilters({ sku: "", sku_match: "exact" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.parent_sku && (
              <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-sm">
                <span>Parent: {filters.parent_sku} ({filters.parent_sku_match})</span>
                <button
                  onClick={() => updateFilters({ parent_sku: "", parent_sku_match: "exact" })}
                  className="hover:bg-purple-200 dark:hover:bg-purple-800/30 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.brand && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Brand: {filters.brand}</span>
                <button
                  onClick={() => updateFilters({ brand: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.category && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Category: {filters.category}</span>
                <button
                  onClick={() => updateFilters({ category: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(filters.price_min || filters.price_max) && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>
                  Price: {filters.price_min || "0"} - {filters.price_max || "∞"}
                </span>
                <button
                  onClick={() => updateFilters({ price_min: "", price_max: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(filters.score_min || filters.score_max) && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>
                  Score: {filters.score_min || "0"} - {filters.score_max || "100"}
                </span>
                <button
                  onClick={() => updateFilters({ score_min: "", score_max: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => updateFilters({
                batch_id: "", status: "", search: "", date_from: "", date_to: "", has_conflict: "",
                entity_code: "", sku: "", sku_match: "exact", parent_sku: "", parent_sku_match: "exact",
                brand: "", category: "", price_min: "", price_max: "", score_min: "", score_max: ""
              })}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Selection Actions Toolbar */}
      {selectedProducts.size > 0 && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-foreground">
                <span className="font-bold">{selectedProducts.size}</span> product
                {selectedProducts.size !== 1 ? "s" : ""} selected
              </div>
              <button
                onClick={clearSelection}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportSelectedProducts}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-md hover:bg-muted text-sm font-medium transition"
              >
                <Download className="h-4 w-4" />
                Export Selected
              </button>
              <button
                onClick={() => setShowBulkUpdateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium transition"
              >
                <EditIcon className="h-4 w-4" />
                Bulk Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-lg bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : products.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        title={isAllSelected ? "Deselect all" : "Select all"}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Batch ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Parent SKU
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Quality
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Languages
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Last Updated
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product, index) => (
                    <tr key={product._id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product._id)}
                          onChange={() => toggleSelectProduct(product._id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {product.has_conflict && (
                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" title="Has conflicts - needs merge" />
                          )}
                          {product.source?.batch_id ? (
                            <button
                              onClick={() => updateFilters({ batch_id: product.source?.batch_id })}
                              className="text-sm font-mono text-primary hover:underline text-left"
                              title="Click to filter by this batch"
                            >
                              {product.source.batch_id}
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No batch</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                            {product.images?.[0]?.url ? (
                              <Image
                                src={product.images[0].url}
                                alt={getMultilingualText(product.name, defaultLanguageCode, "Product image")}
                                width={48}
                                height={48}
                                quality={75}
                                sizes="48px"
                                priority={index < 5}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 max-w-[280px]">
                            <div className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-2">
                              {getMultilingualText(product.name, defaultLanguageCode, "Untitled")}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate flex items-center gap-2">
                              <span>SKU: {product.sku}</span>
                              {product.is_parent && product.variants_entity_code && product.variants_entity_code.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                  Parent
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {product.parent_sku ? (
                            <button
                              onClick={() => updateFilters({ parent_sku: product.parent_sku })}
                              className="font-mono text-primary hover:underline text-left"
                              title="Click to filter by this parent"
                            >
                              {product.parent_sku}
                            </button>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${
                              product.completeness_score >= 80
                                ? "bg-emerald-100 text-emerald-700"
                                : product.completeness_score >= 50
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.completeness_score}
                          </div>
                          {product.critical_issues.length > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              {product.critical_issues.length}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center">
                          <LanguageStatusBadge
                            name={typeof product.name === 'object' ? product.name : undefined}
                            description={typeof product.description === 'object' ? product.description : undefined}
                            availableLanguages={product._available_languages}
                            variant="flags"
                            size="sm"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            product.status === "published"
                              ? "bg-emerald-100 text-emerald-700"
                              : product.status === "draft"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {product.status === "published" && <CheckCircle2 className="h-3 w-3" />}
                          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(product.updated_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                          <div className="text-xs text-muted-foreground/70">
                            {new Date(product.updated_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {product.analytics.views_30d}
                          </span>
                          <Link
                            href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-medium text-foreground">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        isOpen={showBulkUpdateModal}
        onClose={() => setShowBulkUpdateModal(false)}
        selectedCount={selectedProducts.size}
        onUpdate={handleBulkUpdate}
      />

      {/* Create Product Modal */}
      {showCreateModal && (
        <CreateProductModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(entityCode) => {
            setShowCreateModal(false);
            // Redirect to the new product's detail page
            router.push(`${tenantPrefix}/b2b/pim/products/${entityCode}`);
          }}
        />
      )}
    </div>
  );
}

// Create Product Modal Component
function CreateProductModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (entityCode: string) => void;
}) {
  const [formData, setFormData] = useState({
    entity_code: "",
    sku: "",
    name: "",
    description: "",
    price: "",
    currency: "EUR",
    category: "",
    brand: "",
    stock_status: "in_stock" as "in_stock" | "out_of_stock" | "pre_order",
    quantity: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const res = await fetch("/api/b2b/pim/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: formData.price ? parseFloat(formData.price) : 0,
          quantity: formData.quantity ? parseInt(formData.quantity) : 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSuccess(data.entity_code);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Failed to create product");
      }
    } catch (error) {
      console.error("Error creating product:", error);
      setError("Failed to create product. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Create New Product</h2>

          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Required Fields Section */}
            <div className="p-4 rounded border-2 border-primary/20 bg-primary/5">
              <h3 className="text-sm font-semibold mb-3 text-primary">Required Fields</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Entity Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.entity_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        entity_code: e.target.value.toUpperCase().replace(/[^A-Z0-9-_]/g, ""),
                      })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    placeholder="PROD-001"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Unique product identifier (uppercase, alphanumeric, dashes, underscores)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="SKU-001"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Product name"
                  />
                </div>
              </div>
            </div>

            {/* Optional Fields Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Optional Fields</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Product description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      placeholder="0.00"
                    />
                    <select
                      value={formData.currency}
                      onChange={(e) =>
                        setFormData({ ...formData, currency: e.target.value })
                      }
                      className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Brand name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Category name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Stock Status
                  </label>
                  <select
                    value={formData.stock_status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_status: e.target.value as any,
                      })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="pre_order">Pre-order</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3 rounded bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800">
                The product will be created as a <strong>draft</strong> with source <strong>&quot;Manual Entry&quot;</strong>.
                You can add more details and publish it from the product detail page.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create Product"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border border-border hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
