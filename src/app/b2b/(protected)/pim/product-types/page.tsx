"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  Cpu,
  Plus,
  Edit2,
  Trash2,
  Package,
  Search,
  Filter,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getLocalizedString, type MultiLangString } from "@/lib/types/pim";

type ProductTypeFeature = {
  feature_id: string;
  required: boolean;
  display_order: number;
};

type ProductType = {
  _id: string;
  product_type_id: string;
  code?: string;
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

export default function ProductTypesPage() {
  const router = useRouter();
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchProductTypes();
  }, []);

  async function fetchProductTypes() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/product-types?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setProductTypes(data.productTypes);
      }
    } catch (error) {
      console.error("Error fetching product types:", error);
      toast.error("Failed to load product types");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(productType: ProductType) {
    if (productType.product_count > 0) {
      toast.error(
        `Cannot delete product type with ${productType.product_count} products. Please reassign them first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${getLocalizedString(productType.name)}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/product-types/${productType.product_type_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Product type deleted successfully");
        fetchProductTypes();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete product type");
      }
    } catch (error) {
      console.error("Error deleting product type:", error);
      toast.error("Failed to delete product type");
    }
  }

  async function handleSyncAll() {
    setSyncing(true);
    try {
      const res = await fetch("/api/b2b/pim/product-types/sync", {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to sync product types");
        return;
      }

      const data = await res.json();
      toast.success(data.message || "All product types synced successfully");
    } catch (error) {
      console.error("Error syncing product types:", error);
      toast.error("Failed to sync product types");
    } finally {
      setSyncing(false);
    }
  }

  // Filter product types based on search and active status
  const filteredProductTypes = productTypes.filter((pt) => {
    const nameStr = getLocalizedString(pt.name, "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      nameStr.includes(query) ||
      pt.slug.toLowerCase().includes(query) ||
      (pt.code && pt.code.toLowerCase().includes(query));
    const matchesActive = showInactive || pt.is_active;
    return matchesSearch && matchesActive;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Product Types" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Product Types</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {productTypes.length} total product types
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncing || productTypes.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync all ProductType data (code, name, slug) to associated products"
            >
              <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync All"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/b2b/pim/product-types/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              <Plus className="h-5 w-5" />
              New Product Type
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, slug, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition ${
              showInactive
                ? "border-border bg-background"
                : "border-primary bg-primary/10 text-primary"
            }`}
            title="Filter"
          >
            <Filter className="h-5 w-5" />
            {!showInactive && "Active only"}
          </button>
        </div>

        {/* Product Types List */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Product Type Directory
            </h2>
          </div>

          {filteredProductTypes.length === 0 ? (
            <div className="p-12 text-center">
              <Cpu className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "No product types found" : "No product types yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first product type with features"}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => router.push("/b2b/pim/product-types/new")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus className="h-5 w-5" />
                  Create Product Type
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredProductTypes.map((productType) => (
                <div
                  key={productType.product_type_id}
                  className={`flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between ${
                    !productType.is_active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <Cpu className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{getLocalizedString(productType.name)}</h3>
                        {productType.code && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium text-primary">
                            {productType.code}
                          </span>
                        )}
                        {!productType.is_active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Inactive
                          </span>
                        )}
                        {productType.is_active && (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{productType.slug}</p>
                      {productType.description && (
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground line-clamp-1">
                          {getLocalizedString(productType.description)}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {productType.product_count} products
                        </span>
                        <span>
                          {(productType.features || []).length} features
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/b2b/pim/product-types/${productType.product_type_id}`}
                      className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.push(`/b2b/pim/product-types/${productType.product_type_id}/edit`)}
                      className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-muted transition"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(productType)}
                      className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
