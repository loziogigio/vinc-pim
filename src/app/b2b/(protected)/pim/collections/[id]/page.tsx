"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Package } from "lucide-react";
import {
  ProductAssociationSection,
  ProductAssociationConfig,
} from "@/components/pim/ProductAssociationSection";

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

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params?.id as string;

  // State
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    if (collectionId) {
      fetchCollection();
    }
  }, [collectionId]);

  async function fetchCollection() {
    try {
      const res = await fetch(`/api/b2b/pim/collections/${collectionId}`);
      if (!res.ok) throw new Error("Failed to fetch collection");
      const data = await res.json();
      setCollection(data.collection);
      setProductCount(data.collection.product_count || 0);
    } catch (error) {
      console.error("Failed to fetch collection:", error);
      toast.error("Failed to load collection");
      router.push("/b2b/pim/collections");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus() {
    if (!collection) return;

    try {
      const res = await fetch(`/api/b2b/pim/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !collection.is_active }),
      });

      if (res.ok) {
        toast.success(
          collection.is_active ? "Collection deactivated" : "Collection activated"
        );
        fetchCollection();
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast.error("Failed to update status");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Collection not found</div>
      </div>
    );
  }

  // Configuration for ProductAssociationSection
  const productAssociationConfig: ProductAssociationConfig = {
    fetchProductsUrl: `/api/b2b/pim/collections/{id}/products`,
    addProductsUrl: `/api/b2b/pim/collections/{id}/products`,
    removeProductsUrl: `/api/b2b/pim/collections/{id}/products`,
    syncUrl: `/api/b2b/pim/collections/{id}/sync`,
    importUrl: `/api/b2b/pim/collections/{id}/import`,
    exportUrl: `/api/b2b/pim/collections/{id}/export`,
    title: "Products in Collection",
    description: `Products associated with this collection (${productCount} products)`,
    emptyMessage: "No products in this collection yet.",
    addButtonText: "Add Products",
    addModalTitle: "Add Products to Collection",
    addModalDescription: "Search and select products to add to this collection",
    exportFilename: `collection-${collection.slug}-products.csv`,
    // Collections API uses POST with action field for both add/remove
    addRequestActionField: "action",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/b2b/pim/collections"
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {collection.name}
              </h1>
              {!collection.is_active && (
                <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  Inactive
                </span>
              )}
            </div>
            {collection.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {collection.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Package className="h-4 w-4" />
              <span>{productCount} products</span>
              <span className="mx-2">|</span>
              <span>Slug: {collection.slug}</span>
            </div>
          </div>
        </div>
        <button
          onClick={toggleStatus}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            collection.is_active
              ? "bg-muted hover:bg-muted/80 text-foreground"
              : "bg-primary hover:bg-primary/90 text-white"
          }`}
        >
          {collection.is_active ? "Deactivate" : "Activate"}
        </button>
      </div>

      {/* Products Section - Using reusable component */}
      <ProductAssociationSection
        entityId={collectionId}
        config={productAssociationConfig}
        onProductCountChange={setProductCount}
      />
    </div>
  );
}
