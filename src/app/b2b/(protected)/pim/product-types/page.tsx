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
} from "lucide-react";
import { toast } from "sonner";

type ProductTypeFeature = {
  feature_id: string;
  required: boolean;
  display_order: number;
};

type ProductType = {
  _id: string;
  product_type_id: string;
  name: string;
  slug: string;
  description?: string;
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

    if (!confirm(`Are you sure you want to delete "${productType.name}"?`)) {
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

  // Filter product types based on search and active status
  const filteredProductTypes = productTypes.filter((pt) => {
    const matchesSearch =
      pt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pt.slug.toLowerCase().includes(searchQuery.toLowerCase());
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
          <button
            type="button"
            onClick={() => router.push("/b2b/pim/product-types/new")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Product Type
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search product types by name or slug..."
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
            <div className="p-2">
              {filteredProductTypes.map((productType) => (
                <div
                  key={productType.product_type_id}
                  className={`flex items-center gap-3 p-4 rounded-lg border border-border mb-2 hover:shadow-md transition ${
                    !productType.is_active ? "opacity-60" : ""
                  }`}
                >
                  <Cpu className="h-10 w-10 text-primary flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{productType.name}</h3>
                      {!productType.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{productType.slug}</p>
                    {productType.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {productType.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {productType.product_count} products
                      </span>
                      <span>
                        {(productType.features || []).length} features
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/b2b/pim/product-types/${productType.product_type_id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted transition text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.push(`/b2b/pim/product-types/${productType.product_type_id}/edit`)}
                      className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted transition text-sm"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(productType)}
                      className="px-3 py-2 rounded border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
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
