"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Package, Plus, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import type { ITemplateProduct } from "@/lib/constants/notification";

/**
 * Helper function to extract text from multilingual objects
 */
function getMultilingualText(
  text: string | Record<string, string> | undefined | null,
  defaultLanguageCode: string = "it",
  fallback: string = ""
): string {
  if (!text) return fallback;
  if (typeof text === "string") return text;
  if (typeof text !== "object") return String(text);

  try {
    const result = text[defaultLanguageCode] || text.en || Object.values(text)[0];
    if (typeof result === "string" && result) return result;
    if (result) return String(result);
    return fallback;
  } catch {
    return fallback;
  }
}

type PIMProduct = {
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  images?: {
    url: string;
    cdn_key?: string;
    position?: number;
  }[];
};

/**
 * Get the cover image URL from a PIM product
 */
function getProductImageUrl(product: PIMProduct): string {
  if (product.images && product.images.length > 0) {
    // Sort by position, get the first one (cover image at position 0)
    const sortedImages = [...product.images].sort((a, b) => (a.position || 0) - (b.position || 0));
    return sortedImages[0]?.url || "";
  }
  return "";
}

type Props = {
  value: ITemplateProduct[];
  onChange: (products: ITemplateProduct[]) => void;
  disabled?: boolean;
  maxProducts?: number;
};

export function ProductPicker({ value, onChange, disabled, maxProducts }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<PIMProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search products when query changes
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setProducts([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      // Search by SKU with contains match
      const params = new URLSearchParams({
        limit: "20",
        status: "published",
        sku: query,
        sku_match: "contains",
      });

      const res = await fetch(`/api/b2b/pim/products?${params.toString()}`);

      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Error searching products:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchProducts(debouncedSearch);
  }, [debouncedSearch, searchProducts]);

  function toggleProduct(product: PIMProduct) {
    const isSelected = value.some((p) => p.sku === product.sku);

    if (isSelected) {
      onChange(value.filter((p) => p.sku !== product.sku));
    } else {
      // Check max products limit
      if (maxProducts && value.length >= maxProducts) {
        return;
      }

      // Use the best available image URL (full CDN path) for email/notification rendering
      const productImage = getProductImageUrl(product);
      const productName = getMultilingualText(product.name, "it", product.sku);

      onChange([
        ...value,
        {
          sku: product.sku,
          name: productName,
          image: productImage,
          item_ref: product.entity_code,
        },
      ]);
    }
  }

  function removeProduct(sku: string) {
    onChange(value.filter((p) => p.sku !== sku));
  }

  const selectedSkus = new Set(value.map((p) => p.sku));
  const canAddMore = !maxProducts || value.length < maxProducts;

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-1">
        Prodotti
      </label>

      {/* Selected Products */}
      <div className="space-y-2">
        {value.length > 0 && (
          <div className="space-y-2 p-3 rounded border border-border bg-background">
            {value.map((product, index) => (
              <div
                key={product.sku}
                className="flex items-center gap-3 p-2 rounded bg-muted/50"
              >
                <span className="text-xs text-muted-foreground font-medium w-5">
                  {index + 1}
                </span>
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-10 h-10 object-contain rounded bg-white border"
                  />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center rounded bg-muted border">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(product.sku)}
                  disabled={disabled}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(true)}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 p-3 rounded border border-dashed border-border hover:border-primary hover:bg-primary/5 transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">
              {value.length > 0 ? "Aggiungi altri prodotti" : "Aggiungi prodotti"}
            </span>
          </button>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Seleziona Prodotti
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {value.length} selezionati
                    {maxProducts && ` (max ${maxProducts})`}
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-muted transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca per SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Ricerca in corso...</span>
                </div>
              ) : !hasSearched ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Digita almeno 2 caratteri per cercare
                  </p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nessun prodotto trovato
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map((product) => {
                    const isSelected = selectedSkus.has(product.sku);
                    const productName = getMultilingualText(product.name, "it", product.sku);
                    const productImage = getProductImageUrl(product);
                    const isDisabled = !canAddMore && !isSelected;

                    return (
                      <button
                        key={product.entity_code}
                        onClick={() => !isDisabled && toggleProduct(product)}
                        disabled={isDisabled}
                        className={`w-full text-left p-3 rounded border transition ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : isDisabled
                            ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                            : "border-border hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              disabled={isDisabled}
                              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </div>
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={productName}
                              className="w-12 h-12 object-contain rounded bg-white border"
                            />
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center rounded bg-muted border">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {productName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {product.sku}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {value.length} prodott{value.length !== 1 ? "i" : "o"} selezionat{value.length !== 1 ? "i" : "o"}
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
              >
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
