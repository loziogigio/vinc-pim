"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

type Category = {
  _id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  level: number;
  path: string[];
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
  child_count?: number;
  created_at: string;
  updated_at: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/categories?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleExpand(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function buildCategoryTree(
    categories: Category[],
    parentId?: string,
    level = 0
  ): JSX.Element[] {
    const children = categories.filter((c) =>
      parentId ? c.parent_id === parentId : !c.parent_id
    );

    return children.map((category) => {
      const hasChildren = categories.some((c) => c.parent_id === category.category_id);
      const isExpanded = expandedCategories.has(category.category_id);

      return (
        <div key={category.category_id}>
          <div
            className={`flex items-center gap-2 py-2.5 px-3 hover:bg-muted/50 rounded transition ${
              !category.is_active ? "opacity-60" : ""
            }`}
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            {/* Expand/Collapse */}
            <button
              type="button"
              onClick={() => toggleExpand(category.category_id)}
              className={`p-1 hover:bg-muted rounded transition ${
                !hasChildren ? "invisible" : ""
              }`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Hero Image Thumbnail */}
            {category.hero_image?.url ? (
              <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={category.hero_image.url}
                  alt={category.hero_image.alt_text || category.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <FolderTree className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            {/* Category Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">{category.name}</h3>
                {!category.is_active && (
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{category.slug}</p>
            </div>

            {/* Product Count */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{category.product_count}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setParentCategory(category);
                  setShowCreateModal(true);
                }}
                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
                title="Add child category"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingCategory(category)}
                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
                title="Edit category"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(category)}
                className="p-2 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition"
                title="Delete category"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Render children if expanded */}
          {isExpanded && hasChildren && (
            <div>{buildCategoryTree(categories, category.category_id, level + 1)}</div>
          )}
        </div>
      );
    });
  }

  async function handleDelete(category: Category) {
    if (category.product_count > 0) {
      toast.error(
        `Cannot delete category with ${category.product_count} products. Please reassign them first.`
      );
      return;
    }

    if (category.child_count && category.child_count > 0) {
      toast.error(
        `Cannot delete category with ${category.child_count} child categories. Please delete or reassign them first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/categories/${category.category_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Category deleted successfully");
        fetchCategories();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const rootCategories = categories.filter((c) => !c.parent_id);

  return (
    <>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Categories" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Categories</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hierarchical structure • {categories.length} total •{" "}
              {rootCategories.length} root categories
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setParentCategory(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Category
          </button>
        </div>

        {/* Categories Tree */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          {categories.length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No categories yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first category to organize products
              </p>
              <button
                type="button"
                onClick={() => {
                  setParentCategory(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                <Plus className="h-5 w-5" />
                Create Category
              </button>
            </div>
          ) : (
            <div className="p-2">{buildCategoryTree(categories)}</div>
          )}
        </div>

        {/* Help Text */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <h4 className="font-semibold text-blue-900 mb-2">About Categories</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Create nested hierarchies (e.g., Clothing → T-shirts → Graphic Tees)</li>
            <li>• Set SEO fields for better search visibility</li>
            <li>• Add hero images for branding and visual merchandising</li>
            <li>• Each product can be assigned to a single category</li>
          </ul>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          parentCategory={parentCategory}
          categories={categories}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
            setParentCategory(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
            setParentCategory(null);
            fetchCategories();
          }}
        />
      )}
    </>
  );
}

// Category Create/Edit Modal Component
function CategoryModal({
  category,
  parentCategory,
  categories,
  onClose,
  onSuccess,
}: {
  category: Category | null;
  parentCategory: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    slug: category?.slug || "",
    description: category?.description || "",
    parent_id: category?.parent_id || parentCategory?.category_id || "",
    hero_image_url: category?.hero_image?.url || "",
    hero_image_alt: category?.hero_image?.alt_text || "",
    seo_title: category?.seo?.title || "",
    seo_description: category?.seo?.description || "",
    seo_keywords: category?.seo?.keywords?.join(", ") || "",
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true,
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
        parent_id: formData.parent_id || undefined,
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
        };
      }

      const url = category
        ? `/api/b2b/pim/categories/${category.category_id}`
        : "/api/b2b/pim/categories";

      const method = category ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(category ? "Category updated successfully" : "Category created successfully");
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save category");
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Failed to save category");
    } finally {
      setIsSaving(false);
    }
  }

  const availableParents = categories.filter(
    (c) =>
      c.is_active &&
      c.category_id !== category?.category_id && // Can't be its own parent
      !category?.path.includes(c.category_id) // Can't be a descendant
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              {category ? "Edit Category" : "Create Category"}
            </h2>
            {parentCategory && (
              <p className="text-sm text-muted-foreground mt-1">
                Parent: {parentCategory.name}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Name *
                </label>
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
                  placeholder="T-Shirts"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="t-shirts"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Category description..."
              />
            </div>

            {/* Parent & Display Order */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Parent Category
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">None (Root Category)</option>
                  {availableParents.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {"  ".repeat(c.level)}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
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
            </div>

            {/* Hero Image */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Hero Image
              </label>
              <input
                type="url"
                value={formData.hero_image_url}
                onChange={(e) => setFormData({ ...formData, hero_image_url: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="https://example.com/image.jpg"
              />
              {formData.hero_image_url && (
                <div className="relative w-full h-32 rounded overflow-hidden bg-muted">
                  <img
                    src={formData.hero_image_url}
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
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
                <label className="block text-sm font-medium text-foreground mb-1">
                  SEO Title
                </label>
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
              {isSaving ? "Saving..." : category ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
