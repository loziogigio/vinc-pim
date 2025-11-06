"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Plus,
  Minus,
  Search,
  ExternalLink,
  Tag as TagIcon,
  X,
} from "lucide-react";

type TagRecord = {
  tag_id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
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

export default function TagDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tagId = params?.id as string;

  const [tag, setTag] = useState<TagRecord | null>(null);
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

  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [availableSelected, setAvailableSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (tagId) {
      fetchTag();
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId, page, search]);

  async function fetchTag() {
    try {
      const res = await fetch(`/api/b2b/pim/tags/${tagId}`);
      if (!res.ok) throw new Error("Failed to fetch tag");
      const data = await res.json();
      setTag(data.tag);
    } catch (error) {
      console.error("Failed to fetch tag:", error);
      toast.error("Failed to load tag details");
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

      const res = await fetch(`/api/b2b/pim/tags/${tagId}/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch products");

      const data = await res.json();
      setProducts(data.products);
      setTotalProducts(data.pagination.total);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast.error("Failed to load products");
    } finally {
      setProductsLoading(false);
    }
  }

  async function fetchAvailableProducts() {
    try {
      const params = new URLSearchParams({
        limit: "100",
        ...(availableSearch && { search: availableSearch }),
      });
      const res = await fetch(`/api/b2b/pim/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      const currentIds = new Set(products.map((product) => product.entity_code));
      const filtered = (data.products || []).filter(
        (product: Product) => !currentIds.has(product.entity_code)
      );
      setAvailableProducts(filtered);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast.error("Failed to fetch products list");
    }
  }

  function handleSelectAll() {
    if (selectAll) {
      setSelectedProducts(new Set<string>());
    } else {
      setSelectedProducts(new Set(products.map((product) => product.entity_code)));
    }
    setSelectAll(!selectAll);
  }

  function toggleSelected(entityCode: string) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(entityCode)) {
        next.delete(entityCode);
      } else {
        next.add(entityCode);
      }
      return next;
    });
  }

  function toggleAvailable(entityCode: string) {
    setAvailableSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityCode)) {
        next.delete(entityCode);
      } else {
        next.add(entityCode);
      }
      return next;
    });
  }

  useEffect(() => {
    if (showAddModal) {
      setAvailableSelected(new Set<string>());
      fetchAvailableProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSearch, showAddModal, products]);

  async function handleBulkAssociate(entityCodes: string[]) {
    try {
      const res = await fetch(`/api/b2b/pim/tags/${tagId}/products`, {
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
      toast.success(data.message || "Products tagged successfully");

      fetchProducts();
      fetchTag();
      setShowAddModal(false);
      setAvailableSelected(new Set<string>());
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

    if (!confirm(`Remove ${selectedProducts.size} product(s) from this tag?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/tags/${tagId}/products`, {
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

      setSelectedProducts(new Set<string>());
      setSelectAll(false);
      fetchProducts();
      fetchTag();
    } catch (error) {
      console.error("Failed to remove products:", error);
      toast.error("Failed to remove products");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Loading tag details…
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[60vh] text-muted-foreground">
        <p>Tag not found.</p>
        <Link href="/b2b/pim/tags" className="text-primary hover:underline">
          Back to tags
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(totalProducts / limit);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/b2b/pim/tags"
              className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tags
            </Link>
          </div>
          <div className="flex flex-1 items-start gap-4 md:ml-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <TagIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">{tag.name}</h1>
                {!tag.is_active && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Inactive
                  </span>
                )}
                {tag.color && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-border"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.color}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{tag.slug}</p>
              {tag.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{tag.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>{tag.product_count} product(s)</span>
                <span>Display order: {tag.display_order}</span>
                <span>Updated: {new Date(tag.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
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
                placeholder="Search tagged products..."
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
                Showing {products.length} of {totalProducts} products
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
              Loading products…
            </div>
          ) : products.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-muted-foreground">
              No products currently use this tag.
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
                      onChange={() => toggleSelected(product.entity_code)}
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
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add products to tag</h2>
                <p className="text-sm text-muted-foreground">
                  Select products to associate with {tag.name}.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAvailableSelected(new Set<string>());
                  setAvailableSearch("");
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={availableSearch}
                  onChange={(event) => setAvailableSearch(event.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                {availableProducts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No products available. Adjust your search or import more products first.
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
                            onChange={() => toggleAvailable(product.entity_code)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                            {product.image?.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.image.thumbnail}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
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
                onClick={() => {
                  setShowAddModal(false);
                  setAvailableSelected(new Set<string>());
                  setAvailableSearch("");
                }}
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
    </div>
  );
}
