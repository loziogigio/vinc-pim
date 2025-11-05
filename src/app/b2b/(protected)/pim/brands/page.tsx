"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, ExternalLink, Upload, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type Brand = {
  brand_id: string;
  label: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    slug: "",
    description: "",
    logo_url: "",
    website_url: "",
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchBrands();
  }, [search, filterActive, sortBy, sortOrder]);

  async function fetchBrands() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterActive !== "all") params.set("is_active", filterActive);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);

      const res = await fetch(`/api/b2b/pim/brands?${params}`);
      const data = await res.json();
      setBrands(data.brands || []);
    } catch (error) {
      console.error("Failed to fetch brands:", error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingBrand(null);
    setSlugManuallyEdited(false);
    setFormData({
      label: "",
      slug: "",
      description: "",
      logo_url: "",
      website_url: "",
      is_active: true,
      display_order: 0,
    });
    setShowModal(true);
  }

  function openEditModal(brand: Brand) {
    setEditingBrand(brand);
    setSlugManuallyEdited(true);
    setFormData({
      label: brand.label,
      slug: brand.slug,
      description: brand.description || "",
      logo_url: brand.logo_url || "",
      website_url: brand.website_url || "",
      is_active: brand.is_active,
      display_order: brand.display_order,
    });
    setShowModal(true);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/b2b/pim/brands/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to upload logo");
        return;
      }

      const data = await res.json();
      setFormData((prev) => ({ ...prev, logo_url: data.url }));
      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error("Failed to upload logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingBrand
        ? `/api/b2b/pim/brands/${editingBrand.brand_id}`
        : `/api/b2b/pim/brands`;

      const method = editingBrand ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to save brand");
        return;
      }

      toast.success(editingBrand ? "Brand updated successfully" : "Brand created successfully");
      setShowModal(false);
      fetchBrands();
    } catch (error) {
      console.error("Failed to save brand:", error);
      toast.error("Failed to save brand");
    }
  }

  async function handleDelete(brandId: string, productCount: number) {
    if (productCount > 0) {
      toast.error(
        `Cannot delete brand with ${productCount} associated products. Please remove products first.`
      );
      return;
    }

    if (!confirm("Are you sure you want to delete this brand?")) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/brands/${brandId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to delete brand");
        return;
      }

      toast.success("Brand deleted successfully");
      fetchBrands();
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error("Failed to delete brand");
    }
  }

  function generateSlug(label: string) {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Brands</h1>
          <p className="text-muted-foreground mt-1">
            Manage product brands and manufacturers
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Brand
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="created_at">Created Date</option>
          <option value="updated_at">Updated Date</option>
          <option value="label">Name</option>
          <option value="product_count">Product Count</option>
          <option value="display_order">Display Order</option>
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          className="px-4 py-2 border border-input rounded-lg hover:bg-accent"
        >
          {sortOrder === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {/* Brands Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading brands...
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No brands found</p>
          <button
            onClick={openCreateModal}
            className="text-primary hover:underline"
          >
            Create your first brand
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Brand
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Products
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {brands.map((brand) => (
                <tr key={brand.brand_id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.label}
                          className="w-10 h-10 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                          {brand.label.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-foreground">
                          {brand.label}
                        </div>
                        {brand.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {brand.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {brand.slug}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {brand.product_count}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        brand.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {brand.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(brand.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/b2b/pim/brands/${brand.brand_id}`}
                        className="text-sm text-primary hover:underline"
                        title="View products"
                      >
                        View
                      </Link>
                      {brand.website_url && (
                        <a
                          href={brand.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-accent rounded"
                          title="Visit website"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => openEditModal(brand)}
                        className="p-2 hover:bg-accent rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(brand.brand_id, brand.product_count)
                        }
                        className="p-2 hover:bg-destructive/10 text-destructive rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-2xl font-bold text-foreground">
                {editingBrand ? "Edit Brand" : "Create Brand"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.label}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    setFormData({
                      ...formData,
                      label: newLabel,
                      slug: slugManuallyEdited ? formData.slug : generateSlug(newLabel),
                    });
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Nike, Apple, Samsung"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setFormData({ ...formData, slug: e.target.value });
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., nike, apple, samsung"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL-friendly identifier (lowercase, no spaces)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Brief description of the brand..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Brand Logo
                </label>

                {/* Logo Preview */}
                {formData.logo_url && (
                  <div className="mb-3 relative inline-block">
                    <img
                      src={formData.logo_url}
                      alt="Brand logo preview"
                      className="w-32 h-32 object-contain border border-border rounded-lg p-2 bg-muted"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo_url: "" })}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                      title="Remove logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Upload Button */}
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {uploadingLogo ? "Uploading..." : "Upload Logo"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP (max 5MB)
                  </p>
                </div>

                {/* Or enter URL manually */}
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground mb-1">
                    Or enter URL manually:
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) =>
                      setFormData({ ...formData, logo_url: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={formData.website_url}
                  onChange={(e) =>
                    setFormData({ ...formData, website_url: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        display_order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Status
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-foreground">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  {editingBrand ? "Update Brand" : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
