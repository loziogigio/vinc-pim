"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Package,
  Search,
  Filter,
  Image as ImageIcon,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

type Collection = {
  _id: string;
  collection_id: string;
  name: string;
  slug: string;
  description?: string;
  hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/collections?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
      toast.error("Failed to load collections");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(collection: Collection) {
    if (collection.product_count > 0) {
      toast.error(
        `Cannot delete collection with ${collection.product_count} products. Please reassign them first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${collection.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/collections/${collection.collection_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Collection deleted successfully");
        fetchCollections();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete collection");
      }
    } catch (error) {
      console.error("Error deleting collection:", error);
      toast.error("Failed to delete collection");
    }
  }

  // Filter collections based on search and active status
  const filteredCollections = collections.filter((col) => {
    const matchesSearch =
      col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = showInactive || col.is_active;
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
            { label: "Collections" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Collections</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {collections.length} total collections
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Collection
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search collections by name or slug..."
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

        {/* Collections Grid */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          {filteredCollections.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "No collections found" : "No collections yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first collection to group products"}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus className="h-5 w-5" />
                  Create Collection
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCollections.map((collection) => (
                <div
                  key={collection.collection_id}
                  className={`rounded-lg border border-border overflow-hidden hover:shadow-md transition ${
                    !collection.is_active ? "opacity-60" : ""
                  }`}
                >
                  {/* Collection Image */}
                  <div className="h-40 bg-muted flex items-center justify-center overflow-hidden">
                    {collection.hero_image?.url ? (
                      <img
                        src={collection.hero_image.url}
                        alt={collection.hero_image.alt_text || collection.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>

                  {/* Collection Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {collection.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {collection.slug}
                        </p>
                      </div>
                      {!collection.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 ml-2">
                          Inactive
                        </span>
                      )}
                    </div>

                    {collection.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {collection.description}
                      </p>
                    )}

                    {/* Product Count */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                      <Package className="h-4 w-4" />
                      <span>{collection.product_count} products</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      <Link
                        href={`/b2b/pim/collections/${collection.collection_id}`}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted transition text-sm"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditingCollection(collection)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted transition text-sm"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(collection)}
                        className="px-3 py-2 rounded border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCollection) && (
        <CollectionModal
          collection={editingCollection}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCollection(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingCollection(null);
            fetchCollections();
          }}
        />
      )}
    </>
  );
}

// Collection Create/Edit Modal Component
function CollectionModal({
  collection,
  onClose,
  onSuccess,
}: {
  collection: Collection | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: collection?.name || "",
    slug: collection?.slug || "",
    description: collection?.description || "",
    hero_image_url: collection?.hero_image?.url || "",
    hero_image_alt: collection?.hero_image?.alt_text || "",
    hero_image_cdn_key: collection?.hero_image?.cdn_key || "",
    seo_title: collection?.seo?.title || "",
    seo_description: collection?.seo?.description || "",
    seo_keywords: collection?.seo?.keywords?.join(", ") || "",
    display_order: collection?.display_order || 0,
    is_active: collection?.is_active ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        display_order: formData.display_order,
        is_active: formData.is_active,
        seo: {
          title: formData.seo_title,
          description: formData.seo_description,
          keywords: formData.seo_keywords.split(",").map((k) => k.trim()).filter(Boolean),
        },
      };

      if (formData.hero_image_url) {
        payload.hero_image = {
          url: formData.hero_image_url,
          alt_text: formData.hero_image_alt,
          cdn_key: formData.hero_image_cdn_key,
        };
      }

      const url = collection
        ? `/api/b2b/pim/collections/${collection.collection_id}`
        : "/api/b2b/pim/collections";

      const method = collection ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(collection ? "Collection updated successfully" : "Collection created successfully");
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save collection");
      }
    } catch (error) {
      console.error("Error saving collection:", error);
      toast.error("Failed to save collection");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              {collection ? "Edit Collection" : "Create Collection"}
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      name,
                      slug: formData.slug || generateSlug(name),
                    });
                  }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Summer Collection"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="summer-collection"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Collection description..."
              />
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {/* Hero Image */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Hero Image</label>

              {/* Image Upload */}
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file
                    if (!file.type.startsWith("image/")) {
                      toast.error("Please select an image file");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be less than 5MB");
                      return;
                    }

                    // Upload to CDN
                    try {
                      const formData = new FormData();
                      formData.append("image", file);

                      const response = await fetch("/api/b2b/editor/upload-image", {
                        method: "POST",
                        body: formData,
                      });

                      if (!response.ok) {
                        throw new Error("Upload failed");
                      }

                      const data = await response.json();
                      setFormData((prev) => ({
                        ...prev,
                        hero_image_url: data.url,
                        hero_image_cdn_key: data.cdn_key,
                      }));
                      toast.success("Image uploaded successfully");
                    } catch (error) {
                      console.error("Upload error:", error);
                      toast.error("Failed to upload image");
                    }
                  }}
                  className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                <input
                  type="url"
                  value={formData.hero_image_url}
                  onChange={(e) => setFormData({ ...formData, hero_image_url: e.target.value })}
                  placeholder="Or paste image URL..."
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              {/* Image Preview */}
              {formData.hero_image_url && (
                <div className="relative w-full h-48 rounded overflow-hidden bg-muted border border-border">
                  <img
                    src={formData.hero_image_url}
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        hero_image_url: "",
                        hero_image_cdn_key: "",
                        hero_image_alt: "",
                      })
                    }
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    title="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Alt Text */}
              <input
                type="text"
                value={formData.hero_image_alt}
                onChange={(e) => setFormData({ ...formData, hero_image_alt: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Alt text for image"
              />
            </div>

            {/* SEO Fields */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground">SEO Settings</h4>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">SEO Title</label>
                <input
                  type="text"
                  value={formData.seo_title}
                  onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="SEO optimized title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  SEO Description
                </label>
                <textarea
                  value={formData.seo_description}
                  onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                  placeholder="SEO meta description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.seo_keywords}
                  onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="is_active" className="text-sm text-foreground">
                Active (visible to customers)
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-border hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : collection ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
