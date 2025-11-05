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
} from "lucide-react";

type Collection = {
  collection_id: string;
  name: string;
  slug: string;
  description?: string;
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

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params?.id as string;

  // State
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Search & filter
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const limit = 50;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Available products (not yet associated)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [availableSelected, setAvailableSelected] = useState<Set<string>>(new Set());

  // Import state
  const [importMethod, setImportMethod] = useState<"file" | "url">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importAction, setImportAction] = useState<"add" | "remove">("add");
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (collectionId) {
      fetchCollection();
      fetchProducts();
    }
  }, [collectionId, page, search]);

  async function fetchCollection() {
    try {
      const res = await fetch(`/api/b2b/pim/collections/${collectionId}`);
      if (!res.ok) throw new Error("Failed to fetch collection");
      const data = await res.json();
      setCollection(data.collection);
    } catch (error) {
      console.error("Failed to fetch collection:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        collection_id: collectionId,
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const res = await fetch(`/api/b2b/pim/collections/${collectionId}/products?${params}`);
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
        exclude_collection: collectionId,
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
      setSelectedProducts(new Set(products.map(p => p.entity_code)));
    }
    setSelectAll(!selectAll);
  }

  function handleSelectProduct(entityCode: string) {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(entityCode)) {
      newSelected.delete(entityCode);
    } else {
      newSelected.add(entityCode);
    }
    setSelectedProducts(newSelected);
    setSelectAll(newSelected.size === products.length);
  }

  function handleSelectAvailable(entityCode: string) {
    const newSelected = new Set(availableSelected);
    if (newSelected.has(entityCode)) {
      newSelected.delete(entityCode);
    } else {
      newSelected.add(entityCode);
    }
    setAvailableSelected(newSelected);
  }

  async function handleBulkAssociate(entityCodes: string[]) {
    try {
      const res = await fetch(`/api/b2b/pim/collections/${collectionId}/products`, {
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

      // Refresh
      fetchProducts();
      fetchCollection();
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

    if (!confirm(`Remove ${selectedProducts.size} product(s) from this collection?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/collections/${collectionId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_codes: Array.from(selectedProducts),
          action: "remove"
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to remove products");
        return;
      }

      const data = await res.json();
      toast.success(data.message || "Products removed successfully");

      // Refresh
      setSelectedProducts(new Set());
      setSelectAll(false);
      fetchProducts();
      fetchCollection();
    } catch (error) {
      console.error("Failed to remove products:", error);
      toast.error("Failed to remove products");
    }
  }

  async function handleExport(format: "csv" | "xlsx" | "txt") {
    try {
      const res = await fetch(`/api/b2b/pim/collections/${collectionId}/export?format=${format}`);
      if (!res.ok) throw new Error("Failed to export");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `collection-${collection?.slug}-products.${format}`;
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
    // Validation
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
        // File upload method
        const formData = new FormData();
        formData.append("file", importFile!);

        const res = await fetch(`/api/b2b/pim/collections/${collectionId}/import?action=${importAction}`, {
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
        // URL method - fetch file from URL first
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

        const res = await fetch(`/api/b2b/pim/collections/${collectionId}/import?action=${importAction}`, {
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
    } catch (error) {
      console.error("Failed to import:", error);
      toast.error("Failed to import products");
    } finally {
      setImporting(false);
    }
  }

  // Drag and drop handlers
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

      // Validate file type
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

  if (!collection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Collection not found</div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalProducts / limit);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link
            href="/b2b/pim/collections"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Collections
          </Link>

          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{collection.name}</h1>
            {collection.description && (
              <p className="text-muted-foreground mb-3">{collection.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{totalProducts}</span>
              <span className="text-muted-foreground">products</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {selectedProducts.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedProducts.size} selected
                  </span>
                  <button
                    onClick={handleBulkDisassociate}
                    className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 text-sm"
                  >
                    <Minus className="w-4 h-4" />
                    Remove Selected
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Export */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent text-sm">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <div className="absolute right-0 mt-1 w-32 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport("csv")}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent rounded-t-lg"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport("xlsx")}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent"
                  >
                    XLSX
                  </button>
                  <button
                    onClick={() => handleExport("txt")}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent rounded-b-lg"
                  >
                    TXT
                  </button>
                </div>
              </div>

              {/* Import */}
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent text-sm"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>

              {/* Add Products */}
              <button
                onClick={() => {
                  setShowAddModal(true);
                  fetchAvailableProducts();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Products
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {productsLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No products in this collection</p>
            <button
              onClick={() => {
                setShowAddModal(true);
                fetchAvailableProducts();
              }}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
            >
              Add Products
            </button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Product</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">SKU</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Stock</th>
                    <th className="text-right p-4 text-sm font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.entity_code} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.entity_code)}
                          onChange={() => handleSelectProduct(product.entity_code)}
                          className="rounded border-input"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {product.image?.thumbnail && (
                            <img
                              src={product.image.thumbnail}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded border border-border"
                            />
                          )}
                          <div>
                            <div className="font-medium text-foreground">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.entity_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground">{product.sku}</td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === "published"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-foreground">{product.quantity}</td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/b2b/pim/products/${product.entity_code}`}
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalProducts)} of {totalProducts}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-input rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-input rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Products Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Add Products to Collection</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Available Products List */}
              <div className="space-y-2">
                {availableProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No available products found</p>
                ) : (
                  availableProducts.map((product) => (
                    <label
                      key={product.entity_code}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={availableSelected.has(product.entity_code)}
                        onChange={() => handleSelectAvailable(product.entity_code)}
                        className="rounded border-input"
                      />
                      {product.image?.thumbnail && (
                        <img
                          src={product.image.thumbnail}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded border border-border"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-foreground text-sm">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.sku}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-input rounded-lg hover:bg-accent text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAssociate(Array.from(availableSelected))}
                disabled={availableSelected.size === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Add {availableSelected.size} Product{availableSelected.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Import Products</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportUrl("");
                  setImportMethod("file");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Action Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  What would you like to do?
                </label>
                <select
                  value={importAction}
                  onChange={(e) => setImportAction(e.target.value as "add" | "remove")}
                  className="w-full px-3 py-2.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="add">Add products to collection</option>
                  <option value="remove">Remove products from collection</option>
                </select>
              </div>

              {/* Import Method */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Select import method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImportMethod("file")}
                    className={`px-4 py-3 rounded-lg border-2 transition text-sm font-medium ${
                      importMethod === "file"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/50"
                    }`}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-1" />
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMethod("url")}
                    className={`px-4 py-3 rounded-lg border-2 transition text-sm font-medium ${
                      importMethod === "url"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/50"
                    }`}
                  >
                    <ExternalLink className="w-5 h-5 mx-auto mb-1" />
                    From URL
                  </button>
                </div>
              </div>

              {/* File Upload */}
              {importMethod === "file" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Upload file (CSV, XLSX, TXT)
                  </label>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="file"
                      id="file-upload-collection"
                      accept=".csv,.xlsx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImportFile(file);
                          toast.success(`File selected: ${file.name}`);
                        }
                      }}
                      className="hidden"
                    />

                    {!importFile ? (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <Upload className={`w-12 h-12 transition-colors ${
                            isDragging ? "text-primary" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1">
                            {isDragging ? "Drop file here" : "Drag and drop your file here"}
                          </p>
                          <p className="text-xs text-muted-foreground mb-3">
                            or
                          </p>
                          <label
                            htmlFor="file-upload-collection"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 cursor-pointer text-sm font-medium transition"
                          >
                            <Upload className="w-4 h-4" />
                            Choose File
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Supports: CSV, XLSX, TXT (max 10MB)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {importFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(importFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setImportFile(null)}
                          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                        >
                          Remove file
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    File should contain one entity_code per line (TXT) or entity_code column (CSV/XLSX)
                  </p>
                </div>
              )}

              {/* URL Input */}
              {importMethod === "url" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Enter file URL
                  </label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://cdn.example.com/import-file.csv"
                    className="w-full px-3 py-2.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a URL to a CSV, XLSX, or TXT file (e.g., from your CDN or cloud storage)
                  </p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-foreground mb-2">Supported Formats:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>TXT:</strong> One entity_code per line</li>
                  <li>• <strong>CSV:</strong> Header row with entity_code column</li>
                  <li>• <strong>XLSX:</strong> Excel file with entity_code column</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/20">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportUrl("");
                  setImportMethod("file");
                }}
                className="px-4 py-2 border border-input rounded-lg hover:bg-accent text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={(importMethod === "file" && !importFile) || (importMethod === "url" && !importUrl.trim()) || importing}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
