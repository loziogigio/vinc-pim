"use client";

import { useMemo, useEffect, useState } from "react";
import { Search, Filter, ExternalLink, Loader2, Package } from "lucide-react";
import { FACET_FIELDS_CONFIG } from "@/lib/search/facet-config";

const PREVIEW_LIMIT = 6;

interface ParsedSearchUrl {
  basePath: string;
  keyword: string;
  filters: Array<{ key: string; label: string; values: string[] }>;
  queryString: string;
}

interface PreviewProduct {
  id?: string;
  sku: string;
  name: string;
  image?: {
    thumbnail?: string;
    url?: string;
  };
}

interface SearchUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  label?: string;
  helpText?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

// ============================================
// LEGACY TO PIM FIELD NAME MAPPING
// (Same as vinc-b2b/src/framework/basic-rest/product/get-pim-product.tsx)
// ============================================
const LEGACY_TO_PIM_FIELD: Record<string, string> = {
  id_brand: "brand_id",
  promo_type: "promo_type",
  new: "attribute_is_new_b",
  is_new: "attribute_is_new_b",
  promo_codes: "promo_code",
  category: "category_ancestors",
  family: "category_ancestors",
};

/**
 * Map legacy filter keys to PIM field names
 */
function mapFilterKey(key: string): string {
  // Remove 'filters-' prefix if present
  const normalizedKey = key.replace(/^filters-/, "");
  return LEGACY_TO_PIM_FIELD[normalizedKey] || normalizedKey;
}

/**
 * Get human-readable label for a filter field
 */
function getFilterLabel(key: string): string {
  const normalizedKey = key.replace(/^filters-/, "");

  // Check facet config for label
  const facetConfig = FACET_FIELDS_CONFIG[normalizedKey];
  if (facetConfig?.label) {
    return facetConfig.label;
  }

  // Common field mappings
  const labelMap: Record<string, string> = {
    brand_id: "Marca",
    category_id: "Categoria",
    product_type_id: "Tipo Prodotto",
    product_type_code: "Tipo Prodotto",
    collection_ids: "Collezione",
    stock_status: "Disponibilità",
    has_active_promo: "In Promozione",
    tag_groups: "Caratteristiche",
    price_min: "Prezzo Min",
    price_max: "Prezzo Max",
  };

  return labelMap[normalizedKey] || normalizedKey;
}

/**
 * Parse a search URL into structured components
 */
function parseSearchUrl(url: string): ParsedSearchUrl | null {
  const trimmed = url.trim();

  if (!trimmed) return null;

  // Check if it looks like a search URL
  if (!trimmed.includes("?") && !trimmed.startsWith("shop") && !trimmed.startsWith("search") && !trimmed.startsWith("/")) {
    return null;
  }

  try {
    let basePath = "";
    let queryString = trimmed;

    if (trimmed.includes("?")) {
      const parts = trimmed.split("?");
      basePath = parts[0];
      queryString = parts[1] || "";
    } else if (trimmed.startsWith("shop") || trimmed.startsWith("search") || trimmed.startsWith("/shop") || trimmed.startsWith("/search")) {
      basePath = trimmed;
      queryString = "";
    }

    const params = new URLSearchParams(queryString);
    const keyword = params.get("text") || params.get("q") || "";
    const filters: Array<{ key: string; label: string; values: string[] }> = [];

    params.forEach((value, key) => {
      if (key === "text" || key === "q" || key === "limit" || key === "start" || key === "rows" || key === "page") {
        return;
      }

      const normalizedKey = key.startsWith("filters-") ? key.replace(/^filters-/, "") : key;
      const values = value.split(";").map((v) => v.trim()).filter(Boolean);

      if (values.length > 0) {
        filters.push({
          key: normalizedKey,
          label: getFilterLabel(key),
          values,
        });
      }
    });

    if (!keyword && filters.length === 0 && !basePath) {
      return null;
    }

    return {
      basePath: basePath || "/shop",
      keyword,
      filters,
      queryString,
    };
  } catch (error) {
    console.warn("[SearchUrlInput] Unable to parse search URL:", error);
    return null;
  }
}

/**
 * Build filters object from parsed URL (for search API)
 */
function buildFiltersObject(parsed: ParsedSearchUrl): Record<string, string | string[]> {
  const filters: Record<string, string | string[]> = {};

  for (const { key, values } of parsed.filters) {
    const pimKey = mapFilterKey(key);
    // If multiple values, pass as array; otherwise as string
    filters[pimKey] = values.length === 1 ? values[0] : values;
  }

  return filters;
}

/**
 * Fetch search preview using /api/b2b/search/preview endpoint
 * Uses session authentication (handled by middleware for B2B routes)
 */
async function fetchSearchPreview(
  parsed: ParsedSearchUrl,
  signal: AbortSignal
): Promise<PreviewProduct[]> {
  // Build the request body
  const body: Record<string, unknown> = {
    lang: "it",
    rows: PREVIEW_LIMIT,
  };

  // Add text search if keyword is present
  if (parsed.keyword) {
    body.text = parsed.keyword;
  }

  // Build filters object from parsed URL
  if (parsed.filters.length > 0) {
    body.filters = buildFiltersObject(parsed);
  }

  const response = await fetch("/api/b2b/search/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMsg = data.error || data.details || `Search failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  const data = await response.json();

  // Response format: { items: [...], total }
  return (data.items || []).map((product: any) => ({
    id: product.id || product.sku,
    sku: product.sku,
    name: product.name,
    image: product.image,
  }));
}

const PreviewPlaceholder = ({ message }: { message: string }) => (
  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-xs text-slate-500">
    {message}
  </div>
);

export function SearchUrlInput({
  value,
  onChange,
  placeholder = "shop?text=prodotto&filters-brand_id=004",
  label = "URL Ricerca / Vedi Tutti",
  helpText,
  disabled = false,
  showPreview = true,
}: SearchUrlInputProps) {
  const parsed = useMemo(() => parseSearchUrl(value), [value]);

  // Preview state
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Fetch preview products when URL changes
  useEffect(() => {
    if (!showPreview || !parsed || (!parsed.keyword && parsed.filters.length === 0)) {
      setPreviewProducts([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();

    // Debounce the API call
    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);

        const products = await fetchSearchPreview(parsed, controller.signal);
        setPreviewProducts(products);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[SearchUrlInput] preview error", error);
          const errorMessage = error instanceof Error ? error.message : "Unable to load preview";
          setPreviewError(errorMessage);
          setPreviewProducts([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 400); // 400ms debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, parsed, showPreview]);

  // Preview content
  const previewContent = useMemo(() => {
    if (!showPreview) return null;

    if (!parsed || (!parsed.keyword && parsed.filters.length === 0)) {
      return <PreviewPlaceholder message="Inserisci una query per visualizzare l'anteprima dei prodotti." />;
    }

    if (previewLoading) {
      return (
        <div className="flex items-center justify-center py-4 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Caricamento anteprima...
        </div>
      );
    }

    if (previewError) {
      return <PreviewPlaceholder message={previewError} />;
    }

    if (!previewProducts.length) {
      return <PreviewPlaceholder message="Nessun prodotto trovato per questa ricerca." />;
    }

    return (
      <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white">
        {previewProducts.map((product) => (
          <div
            key={product.id || product.sku}
            className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0"
          >
            {product?.image?.thumbnail || product?.image?.url ? (
              <img
                src={product.image.thumbnail || product.image.url}
                alt={product.name}
                className="h-10 w-10 rounded object-cover flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-400 flex-shrink-0">
                <Package className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{product.name ?? product.sku}</p>
              {product.sku && <p className="text-[10px] text-slate-400">SKU: {product.sku}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }, [showPreview, parsed, previewLoading, previewError, previewProducts]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        <Search className="w-4 h-4 inline mr-1" />
        {label}
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:bg-slate-50"
      />

      {helpText && <p className="text-xs text-slate-500">{helpText}</p>}

      {/* Parsed URL Summary */}
      {parsed && (parsed.keyword || parsed.filters.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          {/* Base Path */}
          {parsed.basePath && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ExternalLink className="w-3 h-3" />
              <span className="font-mono">{parsed.basePath}</span>
            </div>
          )}

          {/* Keyword */}
          {parsed.keyword && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 uppercase">Keyword:</span>
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                <Search className="w-3 h-3 mr-1" />
                {parsed.keyword}
              </span>
            </div>
          )}

          {/* Filters */}
          {parsed.filters.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 uppercase">
                <Filter className="w-3 h-3" />
                Filtri:
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.filters.map(({ key, label, values }) => (
                  <div
                    key={key}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 text-xs"
                  >
                    <span className="font-semibold text-slate-500 uppercase text-[10px]">{label}</span>
                    <span className="text-slate-700">
                      {values.length > 2 ? `${values.slice(0, 2).join(", ")} +${values.length - 2}` : values.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Preview */}
      {showPreview && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">Anteprima</p>
          {previewContent}
        </div>
      )}

      {/* URL Format Help */}
      {!parsed && value && (
        <p className="text-xs text-amber-600">
          Formato non riconosciuto. Usa: <code className="bg-amber-50 px-1 py-0.5 rounded">shop?text=keyword&amp;filters-brand_id=004</code>
        </p>
      )}
    </div>
  );
}

export { parseSearchUrl, buildFiltersObject, type ParsedSearchUrl };
