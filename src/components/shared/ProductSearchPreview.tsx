"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Search, Loader2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================================================
// Types
// ============================================================================

export interface SearchPreviewProduct {
  entity_code: string;
  sku: string;
  name: string;
  cover_image_url?: string;
  price?: number;
  stock_status?: string;
}

interface ProductSearchPreviewProps {
  searchQuery: string;
  limit: number;
  /** Already-loaded products (for restoring state on re-open) */
  cachedProducts?: SearchPreviewProduct[];
  onSearchChange: (query: string) => void;
  onLimitChange: (limit: number) => void;
  onProductsLoaded: (products: SearchPreviewProduct[]) => void;
}

// ============================================================================
// Query parsing helpers
// ============================================================================

/** Extract keyword + filters from advanced query strings like `shop?text=moon&filters-brand_id=004` */
function parseAdvancedQuery(raw: string): { keyword: string; filters: Array<{ key: string; values: string[] }> } | null {
  const trimmed = raw.trim();
  if (!/[?=&]/.test(trimmed)) return null;

  try {
    const queryString = trimmed.startsWith("shop?")
      ? trimmed.slice(5)
      : trimmed.startsWith("search?")
        ? trimmed.slice(7)
        : trimmed.replace(/^\?/, "");
    const params = new URLSearchParams(queryString);

    const keyword = params.get("text") || "";
    const filters: Array<{ key: string; values: string[] }> = [];

    params.forEach((value, key) => {
      if (key === "text") return;
      const normalizedKey = key.startsWith("filters-") ? key.replace(/^filters-/, "") : key;
      const values = value.split(";").map((item) => item.trim()).filter(Boolean);
      if (values.length) {
        filters.push({ key: normalizedKey, values });
      }
    });

    return { keyword, filters };
  } catch {
    return null;
  }
}

/** Build POST body for /api/search/search from raw query */
function buildSearchBody(raw: string, limit: number): Record<string, unknown> {
  const trimmed = raw.trim();
  const body: Record<string, unknown> = { lang: "it", rows: limit, start: 0 };

  if (/[?=&]/.test(trimmed)) {
    try {
      const qs = trimmed.startsWith("shop?")
        ? trimmed.slice(5)
        : trimmed.startsWith("search?")
          ? trimmed.slice(7)
          : trimmed.replace(/^\?/, "");
      const parsed = new URLSearchParams(qs);
      const extractedText = parsed.get("text");
      if (extractedText) body.text = extractedText;

      const filters: Record<string, string> = {};
      parsed.forEach((value, key) => {
        if (key === "text") return;
        const filterKey = key.startsWith("filters-") ? key.replace(/^filters-/, "") : key;
        filters[filterKey] = value;
      });
      if (Object.keys(filters).length) body.filters = filters;
    } catch {
      body.text = trimmed;
    }
  } else {
    body.text = trimmed;
  }

  return body;
}

// ============================================================================
// Component
// ============================================================================

export function ProductSearchPreview({
  searchQuery,
  limit,
  cachedProducts,
  onSearchChange,
  onLimitChange,
  onProductsLoaded,
}: ProductSearchPreviewProps) {
  const pathname = usePathname() || "";
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const tenantId = pathname.match(/^\/([^/]+)\/b2b/)?.[1]
    || pathname.match(/^\/([^/]+)\//)?.[1]
    || "";

  const onProductsLoadedRef = useRef(onProductsLoaded);
  useEffect(() => {
    onProductsLoadedRef.current = onProductsLoaded;
  }, [onProductsLoaded]);

  // Parse advanced query for summary display
  const parsedSearchSummary = useMemo(() => parseAdvancedQuery(localQuery), [localQuery]);

  // Debounced parent notification of query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearchChange(localQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, onSearchChange]);

  // Auto-search when query or limit changes
  useEffect(() => {
    if (!localQuery.trim() || !tenantId) {
      onProductsLoadedRef.current([]);
      return;
    }

    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (tenantId) headers["X-Tenant-ID"] = tenantId;

        const requestBody = buildSearchBody(localQuery, limit);

        const response = await fetch("/api/search/search", {
          method: "POST",
          headers,
          credentials: "include",
          signal: abortController.signal,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as { error?: string }).error || "Search failed");
        }

        const data = await response.json();
        const results = (data as any).data?.results || (data as any).results || [];
        const products: SearchPreviewProduct[] = results.map((p: any) => ({
          entity_code: p.entity_code,
          sku: p.sku,
          name: p.name || "",
          cover_image_url: p.cover_image_url,
          price: p.price,
          stock_status: p.stock_status,
        }));

        onProductsLoadedRef.current(products);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearchError("Failed to search products");
          console.error("Product search error:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [localQuery, limit, tenantId]);

  return (
    <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-500" />
        <Label className="font-medium">Product Search</Label>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-slate-500">Search Query</Label>
          <div className="relative">
            <Input
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="e.g. caldaia, climatizzatore, rubinetto"
              className="pr-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Paste a keyword or an advanced query (e.g.{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
              shop?text=moon&amp;filters-brand_id=004
            </code>
            ).
          </p>
          {parsedSearchSummary ? (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {parsedSearchSummary.keyword ? (
                <div className="mb-1">
                  <span className="font-semibold text-slate-700">Keyword:</span>{" "}
                  <span>{parsedSearchSummary.keyword}</span>
                </div>
              ) : null}
              {parsedSearchSummary.filters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parsedSearchSummary.filters.map(({ key, values }) => (
                    <div key={key} className="flex items-center gap-1 rounded bg-white px-2 py-1">
                      <span className="text-[11px] font-semibold uppercase text-slate-500">{key}</span>
                      <span className="text-[11px] text-slate-600">{values.join(", ")}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <Label className="text-xs text-slate-500">Max Products</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value) || 10)}
          />
        </div>

        {searchError ? <p className="text-xs text-red-500">{searchError}</p> : null}

        {cachedProducts && cachedProducts.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">
              Found {cachedProducts.length} products
            </Label>
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
              {cachedProducts.map((product) => (
                <div
                  key={product.entity_code}
                  className="flex flex-col items-center rounded border bg-white p-2"
                >
                  {product.cover_image_url ? (
                    <img
                      src={product.cover_image_url}
                      alt={product.name}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100">
                      <Package className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                  <span className="mt-1 w-full truncate text-center text-[10px] text-slate-600">
                    {product.sku}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {localQuery.trim() && !isSearching && cachedProducts?.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">No products found</p>
        ) : null}
      </div>
    </div>
  );
}
