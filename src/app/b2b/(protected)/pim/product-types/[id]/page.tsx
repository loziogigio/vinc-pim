"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Plus,
  Minus,
  Download,
  Upload,
  Search,
  X,
  ExternalLink,
  Cpu,
} from "lucide-react";
import { getLocalizedString, type MultiLangString } from "@/lib/types/pim";

type ProductTypeFeature = {
  feature_id: string;
  required: boolean;
  display_order: number;
};

type ProductType = {
  product_type_id: string;
  name: MultiLangString;
  slug: string;
  description?: MultiLangString;
  features?: ProductTypeFeature[];
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
};

type Product = {
  entity_code: string;
  sku: string;
  name: string;
  image?: {
    thumbnail: string;
  };
  status: string;
  quantity: number;
};

export default function ProductTypeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productTypeId = params?.id as string;

  const [productType, setProductType] = useState<ProductType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const limit = 50;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [availableSelected, setAvailableSelected] = useState<Set<string>>(new Set());

  const [importMethod, setImportMethod] = useState<"file" | "url">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importAction, setImportAction] = useState<"add" | "remove">("add");
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (productTypeId) {
      fetchProductType();
      fetchProducts();
    }
  }, [productTypeId, page, search]);

  async function fetchProductType() {
    try {
      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}`);
      if (!res.ok) throw new Error("Failed to fetch product type");
      const data = await res.json();
      setProductType(data.productType);
    } catch (error) {
      console.error("Failed to fetch product type:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}/products?${params}`);
      if (!res.ok) throw new Error("Failed to fetch products");

      const data = await res.json();
      setProducts(data.products);
      setTotalProducts(data.pagination.total);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setProductsLoading(false);
    }
  }

  async function fetchAvailableProducts() {
    try {
      const params = new URLSearchParams({
        exclude_product_type: productTypeId,
        limit: "100",
        ...(availableSearch && { search: availableSearch }),
      });

      const res = await fetch(`/api/b2b/pim/products?${params}`);
      if (!res.ok) throw new Error("Failed to fetch available products");

      const data = await res.json();
      setAvailableProducts(data.products);
    } catch (error) {
      console.error("Failed to fetch available products:", error);
    }
  }

  function handleSelectAll() {
    if (selectAll) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p) => p.entity_code)));
    }
    setSelectAll(!selectAll);
  }

  function handleSelectProduct(entityCode: string) {
    const next = new Set(selectedProducts);
    if (next.has(entityCode)) {
      next.delete(entityCode);
    } else {
      next.add(entityCode);
    }
    setSelectedProducts(next);
    setSelectAll(next.size === products.length);
  }

  function handleSelectAvailable(entityCode: string) {
    const next = new Set(availableSelected);
    if (next.has(entityCode)) {
      next.delete(entityCode);
    } else {
      next.add(entityCode);
    }
    setAvailableSelected(next);
  }

  async function handleBulkAssociate(entityCodes: string[]) {
    try {
      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_codes: entityCodes, action: "add" }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to associate products");
        return;
      }

      const data = await res.json();
      toast.success(data.message || "Products associated successfully");

      fetchProducts();
      fetchProductType();
      setShowAddModal(false);
      setAvailableSelected(new Set());
    } catch (error) {
      console.error("Failed to associate products:", error);
      toast.error("Failed to associate products");
    }
  }

  async function handleBulkDisassociate() {
    if (selectedProducts.size === 0) {
      toast.warning("Please select products to remove");
      return;
    }

    if (!confirm(`Remove ${selectedProducts.size} product(s) from this product type?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_codes: Array.from(selectedProducts),
          action: "remove",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to remove products");
        return;
      }

      const data = await res.json();
      toast.success(data.message || "Products removed successfully");

      setSelectedProducts(new Set());
      setSelectAll(false);
      fetchProducts();
      fetchProductType();
    } catch (error) {
      console.error("Failed to remove products:", error);
      toast.error("Failed to remove products");
    }
  }

  async function handleExport(format: "csv" | "xlsx" | "txt") {
    try {
      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}/export?format=${format}`);
      if (!res.ok) throw new Error("Failed to export");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `product-type-${productType?.slug}-products.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Failed to export:", error);
      toast.error("Failed to export products");
    }
  }

  async function handleImport() {
    if (importMethod === "file" && !importFile) {
      toast.warning("Please select a file");
      return;
    }
    if (importMethod === "url" && !importUrl.trim()) {
      toast.warning("Please enter a file URL");
      return;
    }

    setImporting(true);
    try {
      if (importMethod === "file") {
        const formData = new FormData();
        formData.append("file", importFile!);

        const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}/import?action=${importAction}`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || "Failed to import");
          return;
        }

        const data = await res.json();
        toast.success(data.message || "Import job started successfully");
      } else {
        toast.info("Fetching file from URL...");
        const fetchRes = await fetch(importUrl);
        if (!fetchRes.ok) {
          toast.error("Failed to fetch file from URL");
          return;
        }

        const blob = await fetchRes.blob();
        const fileName = importUrl.split("/").pop() || "import.csv";
        const file = new File([blob], fileName, { type: blob.type });

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}/import?action=${importAction}`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || "Failed to import");
          return;
        }

        const data = await res.json();
        toast.success(data.message || "Import job started successfully");
      }

      setShowImportModal(false);
      setImportFile(null);
      setImportUrl("");
      setImportMethod("file");
      fetchProducts();
      fetchProductType();
    } catch (error) {
      console.error("Failed to import:", error);
      toast.error("Failed to import products");
    } finally {
      setImporting(false);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".txt")) {
        setImportFile(file);
        setImportMethod("file");
        toast.success(`File selected: ${file.name}`);
      } else {
        toast.error("Invalid file type. Please upload CSV, XLSX, or TXT files only.");
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!productType) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Product type not found</div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalProducts / limit);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link
            href="/b2b/pim/product-types"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Product Types
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Cpu className="w-10 h-10 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">{getLocalizedString(productType.name)}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Slug: {productType.slug}</span>
                    <span>Products: {productType.product_count}</span>
                    <span>Features: {productType.features?.length || 0}</span>
                    <span className={productType.is_active ? "text-green-600" : "text-red-600"}>
                      {productType.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition"
              >
                <Upload className="h-4 w-4" />
                Import Products
              </button>
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition">
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <div className="absolute right-0 mt-1 w-32 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport("csv")}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted rounded-t-lg"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport("xlsx")}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    XLSX
                  </button>
                  <button
                    onClick={() => handleExport("txt")}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted rounded-b-lg"
                  >
                    TXT
                  </button>
                </div>
              </div>
              <Link
                href={`/b2b/pim/product-types/${productTypeId}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                Edit Product Type
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Product Type Details</h2>
              {productType.description && (
                <p className="text-sm leading-6 text-muted-foreground">{getLocalizedString(productType.description)}</p>
              )}
              <dl className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Display Order</dt>
                  <dd>{productType.display_order}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Updated</dt>
                  <dd>{new Date(productType.updated_at).toLocaleString()}</dd>
                </div>
              </dl>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Assigned Features</h3>
                {productType.features && productType.features.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {productType.features.map((feature) => (
                      <li
                        key={feature.feature_id}
                        className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
                      >
                        <span>Feature ID: {feature.feature_id}</span>
                        <span>
                          Order {feature.display_order} • {feature.required ? "Required" : "Optional"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No features assigned to this product type.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search products by name or SKU..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowAddModal(true);
                      fetchAvailableProducts();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add Products
                  </button>
                  <button
                    onClick={handleBulkDisassociate}
                    disabled={selectedProducts.size === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" />
                    Remove Selected
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Associated Products</h2>
                  <p className="text-sm text-muted-foreground">
                    Showing {products.length} of {totalProducts} product(s)
                  </p>
                </div>
                {products.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectAll ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>

              {productsLoading ? (
                <div className="px-6 py-20 text-center text-sm text-muted-foreground">
                  Loading products...
                </div>
              ) : products.length === 0 ? (
                <div className="px-6 py-20 text-center text-sm text-muted-foreground">
                  No products found for this product type.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {products.map((product) => {
                    const isSelected = selectedProducts.has(product.entity_code);
                    return (
                      <label
                        key={product.entity_code}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectProduct(product.entity_code)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                          {product.image?.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image.thumbnail}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{product.name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {product.status}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            SKU: {product.sku} • Qty: {product.quantity}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/b2b/pim/products/${product.entity_code}`)}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          type="button"
                        >
                          View
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </label>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-4 text-sm">
                  <div>
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                      className="rounded-md border border-border px-3 py-1 hover:bg-muted transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={page === totalPages}
                      className="rounded-md border border-border px-3 py-1 hover:bg-muted transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <button
                  onClick={() => router.push(`/b2b/pim/features`)}
                  className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted transition"
                >
                  Manage Technical Features
                </button>
                <button
                  onClick={() => router.push(`/b2b/pim/product-types/${productTypeId}/edit`)}
                  className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted transition"
                >
                  Edit Product Type
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add products to product type</h2>
                <p className="text-sm text-muted-foreground">
                  Select products to associate with {getLocalizedString(productType.name)}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={availableSearch}
                  onChange={(event) => setAvailableSearch(event.target.value)}
                  placeholder="Search available products..."
                  className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                {availableProducts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No products available. Adjust your search or import products first.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {availableProducts.map((product) => {
                      const isSelected = availableSelected.has(product.entity_code);
                      return (
                        <label
                          key={product.entity_code}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectAvailable(product.entity_code)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                            {product.image?.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.image.thumbnail}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{product.name}</div>
                            <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAssociate(Array.from(availableSelected))}
                disabled={availableSelected.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add {availableSelected.size || ""} product(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Import products</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a file to add or remove products from {getLocalizedString(productType.name)}
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="radio"
                    name="import-action"
                    value="add"
                    checked={importAction === "add"}
                    onChange={() => setImportAction("add")}
                  />
                  Add products
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="radio"
                    name="import-action"
                    value="remove"
                    checked={importAction === "remove"}
                    onChange={() => setImportAction("remove")}
                  />
                  Remove products
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="radio"
                    name="import-method"
                    value="file"
                    checked={importMethod === "file"}
                    onChange={() => setImportMethod("file")}
                  />
                  Upload file
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="radio"
                    name="import-method"
                    value="url"
                    checked={importMethod === "url"}
                    onChange={() => setImportMethod("url")}
                  />
                  Provide URL
                </label>
              </div>

              {importMethod === "file" ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm ${
                    isDragging
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <Upload className="h-8 w-8" />
                  <div>
                    Drag and drop a CSV, XLSX, or TXT file here, or{" "}
                    <label className="cursor-pointer text-primary underline">
                      browse
                      <input
                        type="file"
                        accept=".csv,.xlsx,.txt"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setImportFile(file);
                            toast.success(`File selected: ${file.name}`);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {importFile && (
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                      {importFile.name}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder="https://example.com/products.csv"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Use the template exported from this product type to ensure the correct columns are
                provided. Up to 5,000 rows per import are supported.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? "Processing..." : "Start Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
