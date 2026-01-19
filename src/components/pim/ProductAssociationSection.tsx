"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Search,
  Trash2,
  Upload,
  Download,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ProductSearchModal } from "./ProductSearchModal";

type Product = {
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  image?: { thumbnail: string };
  images?: { url: string }[];
  status: string;
  quantity?: number;
};

type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type ProductAssociationConfig = {
  // API endpoints
  fetchProductsUrl: string; // e.g., "/api/b2b/pim/collections/{id}/products"
  addProductsUrl: string; // POST to add products
  removeProductsUrl: string; // DELETE to remove products
  syncUrl?: string; // POST to sync to Solr
  importUrl?: string; // POST to import from file
  exportUrl?: string; // GET to export to CSV

  // Labels
  title?: string;
  description?: string;
  emptyMessage?: string;
  addButtonText?: string;
  addModalTitle?: string;
  addModalDescription?: string;
  exportFilename?: string;

  // Request body field names (different APIs may use different field names)
  addRequestBodyKey?: string; // e.g., "entity_codes" or "entity_codes"
  addRequestActionField?: string; // e.g., "action" for collections API
  removeRequestBodyKey?: string; // e.g., "entity_codes"
};

type Props = {
  entityId: string;
  config: ProductAssociationConfig;
  onProductCountChange?: (count: number) => void;
};

function getProductName(product: Product): string {
  if (typeof product.name === "string") return product.name;
  return (
    product.name?.it ||
    product.name?.en ||
    Object.values(product.name || {})[0] ||
    ""
  );
}

function getProductImage(product: Product): string | null {
  // Check images array (sorted by position, first is cover)
  if (product.images && product.images.length > 0) {
    const img = product.images[0];
    if (typeof img === "string") return img;
    if (img?.url) return img.url;
    if (img?.thumbnail) return img.thumbnail;
  }
  // Fallback to image object
  if (product.image?.thumbnail) return product.image.thumbnail;
  if (product.image?.url) return (product.image as any).url;
  return null;
}

export function ProductAssociationSection({
  entityId,
  config,
  onProductCountChange,
}: Props) {
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const [selectingAll, setSelectingAll] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Actions
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use refs for callbacks and config to avoid re-triggering useEffect
  const onProductCountChangeRef = useRef(onProductCountChange);
  const configRef = useRef(config);

  useEffect(() => {
    onProductCountChangeRef.current = onProductCountChange;
  }, [onProductCountChange]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const limit = 20;

  // Fetch products - only entityId, search, page trigger refetch
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const url = configRef.current.fetchProductsUrl.replace("{id}", entityId);
      const res = await fetch(`${url}?${params.toString()}`);

      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setPagination(data.pagination || null);
        if (onProductCountChangeRef.current && data.pagination?.total !== undefined) {
          onProductCountChangeRef.current(data.pagination.total);
        }
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, [entityId, search, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Selection handlers
  function selectAllVisible() {
    const newSet = new Set(selectedProducts);
    products.forEach((p) => newSet.add(p.entity_code));
    setSelectedProducts(newSet);
  }

  async function selectAllProducts() {
    if (!pagination || pagination.total === 0) return;

    setSelectingAll(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", "1");
      params.set("limit", "1000");

      const url = config.fetchProductsUrl.replace("{id}", entityId);
      const res = await fetch(`${url}?${params.toString()}`);

      if (res.ok) {
        const data = await res.json();
        const allProducts = data.products || [];
        const newSet = new Set(selectedProducts);
        allProducts.forEach((p: Product) => newSet.add(p.entity_code));
        setSelectedProducts(newSet);
      }
    } catch (error) {
      console.error("Failed to select all products:", error);
    } finally {
      setSelectingAll(false);
    }
  }

  function unselectAll() {
    setSelectedProducts(new Set());
  }

  function toggleProduct(entityCode: string) {
    const newSet = new Set(selectedProducts);
    if (newSet.has(entityCode)) {
      newSet.delete(entityCode);
    } else {
      newSet.add(entityCode);
    }
    setSelectedProducts(newSet);
  }

  // Add products
  async function handleAddProducts(entityCodes: string[]) {
    if (entityCodes.length === 0) return;

    try {
      const url = config.addProductsUrl.replace("{id}", entityId);
      const bodyKey = config.addRequestBodyKey || "entity_codes";
      const body: Record<string, any> = { [bodyKey]: entityCodes };

      // Some APIs (like collections) need an action field
      if (config.addRequestActionField) {
        body[config.addRequestActionField] = "add";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(
          data.message || `Added ${data.added || data.modified || entityCodes.length} product(s)`
        );
        setShowAddModal(false);
        fetchProducts();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add products");
      }
    } catch (error) {
      console.error("Failed to add products:", error);
      toast.error("Failed to add products");
    }
  }

  // Remove selected products
  async function handleRemoveSelected() {
    if (selectedProducts.size === 0) return;

    if (
      !confirm(`Remove ${selectedProducts.size} product(s) from this entity?`)
    ) {
      return;
    }

    try {
      const url = config.removeProductsUrl.replace("{id}", entityId);
      const bodyKey = config.removeRequestBodyKey || "entity_codes";
      const body: Record<string, any> = {
        [bodyKey]: Array.from(selectedProducts),
      };

      // Some APIs (like collections) use POST with action field instead of DELETE
      if (config.addRequestActionField) {
        body[config.addRequestActionField] = "remove";
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          toast.success(
            data.message || `Removed ${data.removed || data.modified || selectedProducts.size} product(s)`
          );
          setSelectedProducts(new Set());
          fetchProducts();
        } else {
          const error = await res.json();
          toast.error(error.error || "Failed to remove products");
        }
      } else {
        // Standard DELETE request
        const res = await fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          toast.success(
            `Removed ${data.removed || selectedProducts.size} product(s)`
          );
          setSelectedProducts(new Set());
          fetchProducts();
        } else {
          const error = await res.json();
          toast.error(error.error || "Failed to remove products");
        }
      }
    } catch (error) {
      console.error("Failed to remove products:", error);
      toast.error("Failed to remove products");
    }
  }

  // Sync to Solr
  async function handleSyncToSolr() {
    if (!config.syncUrl || !pagination || pagination.total === 0) return;

    setSyncing(true);
    try {
      const url = config.syncUrl.replace("{id}", entityId);
      const res = await fetch(url, { method: "POST" });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced ${data.synced} product(s) to Solr`);
      } else {
        const error = await res.json();
        toast.error(error.error || "Sync failed");
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      toast.error("Failed to sync products to Solr");
    } finally {
      setSyncing(false);
    }
  }

  // Import products
  async function handleImport() {
    if (!config.importUrl || !importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const url = config.importUrl.replace("{id}", entityId);
      const res = await fetch(`${url}?action=add`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Import started: ${data.total_items || data.added || 0} products`);
        setShowImportModal(false);
        setImportFile(null);
        setTimeout(() => fetchProducts(), 2000);
      } else {
        const error = await res.json();
        toast.error(error.error || "Import failed");
      }
    } catch (error) {
      console.error("Failed to import:", error);
      toast.error("Failed to import products");
    } finally {
      setImporting(false);
    }
  }

  // Export products
  async function handleExport() {
    if (!config.exportUrl) return;

    try {
      const url = config.exportUrl.replace("{id}", entityId);
      const res = await fetch(url);

      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = config.exportFilename || `products-${entityId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        toast.success("Export downloaded");
      }
    } catch (error) {
      console.error("Failed to export:", error);
      toast.error("Failed to export products");
    }
  }

  const totalProducts = pagination?.total || 0;
  const totalPages = pagination?.pages || Math.ceil(totalProducts / limit);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {config.title || "Associated Products"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {config.description || `Products associated with this entity (${totalProducts} products)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync to Solr */}
          {config.syncUrl && (
            <button
              onClick={handleSyncToSolr}
              disabled={syncing || totalProducts === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border text-sm hover:bg-muted transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync"}
            </button>
          )}

          {/* Import */}
          {config.importUrl && (
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border text-sm hover:bg-muted transition"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
          )}

          {/* Export */}
          {config.exportUrl && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border text-sm hover:bg-muted transition"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}

          {/* Add Products */}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            {config.addButtonText || "Add Products"}
          </button>
        </div>
      </div>

      {/* Search and Remove */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:border-primary focus:outline-none text-sm"
            />
          </div>
          {selectedProducts.size > 0 && (
            <button
              onClick={handleRemoveSelected}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border border-red-200 text-red-600 text-sm hover:bg-red-50 transition"
            >
              <Trash2 className="h-4 w-4" />
              Remove {selectedProducts.size} selected
            </button>
          )}
        </div>
      </div>

      {/* Selection Options */}
      {products.length > 0 && (
        <div className="px-6 py-2 border-b border-border bg-muted/20 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedProducts.size > 0 ? (
              <>{selectedProducts.size} selected</>
            ) : (
              <>
                Showing {products.length} of {totalProducts} products
              </>
            )}
          </span>
          <div className="flex items-center gap-2 text-sm">
            {selectedProducts.size > 0 ? (
              <button
                onClick={unselectAll}
                className="text-primary hover:underline"
              >
                Unselect all
              </button>
            ) : (
              <>
                <button
                  onClick={selectAllVisible}
                  className="text-primary hover:underline"
                >
                  Select visible ({products.length})
                </button>
                {totalProducts > products.length && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <button
                      onClick={selectAllProducts}
                      disabled={selectingAll}
                      className="text-primary hover:underline disabled:opacity-50"
                    >
                      {selectingAll ? "Loading..." : `Select all (${totalProducts})`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          {config.emptyMessage || "No products associated yet."}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {products.map((product) => (
            <div
              key={product.entity_code}
              className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition"
            >
              <input
                type="checkbox"
                checked={selectedProducts.has(product.entity_code)}
                onChange={() => toggleProduct(product.entity_code)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                {getProductImage(product) ? (
                  <img
                    src={getProductImage(product)!}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {getProductName(product)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {product.entity_code}
                  {product.sku && ` | ${product.sku}`}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  product.status === "published"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {product.status}
              </span>
              <Link
                href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                className="text-xs text-primary hover:underline"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalProducts > limit && (
        <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border border-border text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded border border-border text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Add Products Modal */}
      <ProductSearchModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSelect={handleAddProducts}
        excludeEntityCodes={products.map((p) => p.entity_code)}
        title={config.addModalTitle || "Add Products"}
        description={config.addModalDescription || "Search and select products to add"}
        selectButtonText="Add Products"
      />

      {/* Import Modal */}
      {showImportModal && config.importUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                Import Products
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="p-1 rounded hover:bg-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a file with product entity codes (one per line). Supported
                formats: CSV, XLSX, XLS, TXT
              </p>

              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                {importFile ? (
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {importFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">
                      Click or drag file to upload
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="px-4 py-2 rounded border border-border hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90 transition disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
