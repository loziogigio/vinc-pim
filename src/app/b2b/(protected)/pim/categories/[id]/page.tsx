"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ArrowLeft, Edit, Plus, X, Search, Package, Trash2 } from "lucide-react";

type Product = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string;
  status: "draft" | "published" | "archived";
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  image?: {
    thumbnail: string;
  };
};

type Category = {
  _id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  display_order: number;
  is_active: boolean;
};

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCategoryAndProducts();
  }, [id]);

  async function fetchCategoryAndProducts() {
    setIsLoading(true);
    try {
      // Fetch category details
      const categoryRes = await fetch(`/api/b2b/pim/categories?include_inactive=true`);
      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        const cat = categoryData.categories.find((c: Category) => c.category_id === id);
        setCategory(cat || null);
      }

      // Fetch products in this category
      const productsRes = await fetch(`/api/b2b/pim/products?category_id=${id}&limit=1000`);
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.products || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load category details");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAvailableProducts() {
    try {
      // Fetch all products not in this category
      const res = await fetch(`/api/b2b/pim/products?limit=1000`);
      if (res.ok) {
        const data = await res.json();
        const available = data.products.filter(
          (p: Product) => !products.some((existing) => existing.entity_code === p.entity_code)
        );
        setAvailableProducts(available);
      }
    } catch (error) {
      console.error("Error fetching available products:", error);
    }
  }

  async function handleAddProducts() {
    if (selectedProducts.size === 0) {
      toast.error("Please select at least one product");
      return;
    }

    try {
      const promises = Array.from(selectedProducts).map((entityCode) =>
        fetch(`/api/b2b/pim/products/${entityCode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: {
              id: category?.category_id,
              name: category?.name,
              slug: category?.slug,
            },
          }),
        })
      );

      await Promise.all(promises);
      toast.success(`Added ${selectedProducts.size} product(s) to ${category?.name}`);
      setShowAddModal(false);
      setSelectedProducts(new Set());
      fetchCategoryAndProducts();
    } catch (error) {
      console.error("Error adding products:", error);
      toast.error("Failed to add products");
    }
  }

  async function handleRemoveProducts() {
    if (selectedForRemoval.size === 0) {
      toast.error("Please select at least one product to remove");
      return;
    }

    try {
      const promises = Array.from(selectedForRemoval).map((entityCode) =>
        fetch(`/api/b2b/pim/products/${entityCode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: null,
          }),
        })
      );

      await Promise.all(promises);
      toast.success(`Removed ${selectedForRemoval.size} product(s) from category`);
      setSelectedForRemoval(new Set());
      fetchCategoryAndProducts();
    } catch (error) {
      console.error("Error removing products:", error);
      toast.error("Failed to remove products");
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAvailableProducts = availableProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Categories", href: "/b2b/pim/categories" },
            { label: "Loading..." },
          ]}
        />
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Categories", href: "/b2b/pim/categories" },
            { label: "Not Found" },
          ]}
        />
        <div className="rounded-lg bg-card p-8 shadow-sm text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Category Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The category you're looking for doesn't exist.
          </p>
          <Link
            href="/b2b/pim/categories"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Categories", href: "/b2b/pim/categories" },
          { label: category.name },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/b2b/pim/categories"
            className="p-2 rounded border border-border hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{category.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {products.length} product(s) in this category
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/b2b/pim/categories/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-md hover:bg-muted transition"
          >
            <Edit className="h-4 w-4" />
            Edit Category
          </Link>
          <button
            onClick={() => {
              setShowAddModal(true);
              fetchAvailableProducts();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            Add Products
          </button>
        </div>
      </div>

      {/* Category Info */}
      {category.description && (
        <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedForRemoval.size > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-900">
            {selectedForRemoval.size} product(s) selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedForRemoval(new Set())}
              className="px-4 py-2 bg-white border border-amber-300 rounded-md hover:bg-amber-50 text-sm transition"
            >
              Clear Selection
            </button>
            <button
              onClick={handleRemoveProducts}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm transition"
            >
              <Trash2 className="h-4 w-4" />
              Remove Selected
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Products List */}
      <div className="rounded-lg bg-card shadow-sm border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Products in Category</h2>
          {filteredProducts.length > 0 && (
            <button
              onClick={() => {
                if (selectedForRemoval.size === filteredProducts.length) {
                  setSelectedForRemoval(new Set());
                } else {
                  setSelectedForRemoval(new Set(filteredProducts.map((p) => p.entity_code)));
                }
              }}
              className="text-sm text-primary hover:underline"
            >
              {selectedForRemoval.size === filteredProducts.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
        <div className="divide-y divide-border">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No products found matching your search"
                  : "No products in this category yet"}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <label
                key={product.entity_code}
                className="p-4 flex items-center gap-3 hover:bg-muted/30 transition cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedForRemoval.has(product.entity_code)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedForRemoval);
                    if (e.target.checked) {
                      newSelected.add(product.entity_code);
                    } else {
                      newSelected.delete(product.entity_code);
                    }
                    setSelectedForRemoval(newSelected);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {product.image?.thumbnail ? (
                    <img src={product.image.thumbnail} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <Link
                    href={`/b2b/pim/products/${product.entity_code}`}
                    className="font-medium text-foreground hover:text-primary transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    product.status === "published"
                      ? "bg-emerald-100 text-emerald-700"
                      : product.status === "draft"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {product.status}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Add Products Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Add Products to {category.name}</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedProducts(new Set());
                  }}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {filteredAvailableProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No available products found</p>
                  </div>
                ) : (
                  filteredAvailableProducts.map((product) => (
                    <label
                      key={product.entity_code}
                      className="flex items-center gap-3 p-3 rounded border border-border hover:bg-muted/30 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.entity_code)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedProducts);
                          if (e.target.checked) {
                            newSelected.add(product.entity_code);
                          } else {
                            newSelected.delete(product.entity_code);
                          }
                          setSelectedProducts(newSelected);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.image?.thumbnail ? (
                          <img src={product.image.thumbnail} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedProducts.size} product(s) selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedProducts(new Set());
                  }}
                  className="px-4 py-2 rounded border border-border hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProducts}
                  disabled={selectedProducts.size === 0}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
