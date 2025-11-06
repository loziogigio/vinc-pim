"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Search, Trash2, Upload, X } from "lucide-react";

export type CategoryRecord = {
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string | null;
  level: number;
  path: string[];
  display_order: number;
  is_active: boolean;
  hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  product_count?: number;
  child_count?: number;
};

type CategoryModalProps = {
  category: CategoryRecord | null;
  parentCategory: CategoryRecord | null;
  categories: CategoryRecord[];
  onClose: () => void;
  onSuccess: () => void;
};

type FlattenedCategory = CategoryRecord & { _displayLevel?: number };

function SearchableCategorySelect({
  categories,
  value,
  onChange,
  excludeCategoryId,
}: {
  categories: CategoryRecord[];
  value: string;
  onChange: (value: string) => void;
  excludeCategoryId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableParents = categories
    .filter((category) => {
      if (!category.is_active) return false;
      if (category.category_id === excludeCategoryId) return false;
      if (excludeCategoryId && category.path?.includes(excludeCategoryId)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });

  const renderCategoryOptions = (parentId: string | null = null, level = 0): FlattenedCategory[] => {
    const children = availableParents
      .filter((category) => (parentId === null ? !category.parent_id : category.parent_id === parentId))
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.name.localeCompare(b.name);
      });

    return children.flatMap((category) => {
      const hasChildren = availableParents.some((item) => item.parent_id === category.category_id);
      return [
        { ...category, _displayLevel: level },
        ...(hasChildren ? renderCategoryOptions(category.category_id, level + 1) : []),
      ];
    });
  };

  const flatCategories = renderCategoryOptions();
  const filteredCategories = searchQuery
    ? flatCategories.filter(
        (category) =>
          category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          category.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : flatCategories;

  const selectedCategory = value ? categories.find((category) => category.category_id === value) : null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-left focus:border-primary focus:outline-none flex items-center justify-between"
      >
        <span className={selectedCategory ? "text-foreground" : "text-muted-foreground"}>
          {selectedCategory ? selectedCategory.name : "None (Root Category)"}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b border-border sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-border rounded focus:border-primary focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearchQuery("");
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition ${
                !value ? "bg-primary/10 text-primary font-medium" : ""
              }`}
            >
              None (Root Category)
            </button>

            {filteredCategories.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No categories found</div>
            ) : (
              filteredCategories.map((category) => {
                const level = category._displayLevel || 0;

                return (
                  <button
                    key={category.category_id}
                    type="button"
                    onClick={() => {
                      onChange(category.category_id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full py-2.5 px-4 text-left text-sm hover:bg-muted transition ${
                      value === category.category_id ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-1 flex-shrink-0" style={{ width: `${level * 24}px` }}>
                        {level > 0 && (
                          <>
                            {Array(level - 1)
                              .fill(0)
                              .map((_, index) => (
                                <span key={index} className="text-muted-foreground/40 text-xs w-6 text-center">
                                  │
                                </span>
                              ))}
                            <span className="text-muted-foreground/40 text-xs w-6">⌞</span>
                          </>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground">{category.name}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const CategoryModal = ({
  category,
  parentCategory,
  categories,
  onClose,
  onSuccess,
}: CategoryModalProps) => {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    slug: category?.slug || "",
    description: category?.description || "",
    parent_id: category?.parent_id || parentCategory?.category_id || "",
    hero_image_url: category?.hero_image?.url || "",
    hero_image_alt: category?.hero_image?.alt_text || "",
    hero_image_cdn_key: category?.hero_image?.cdn_key || "",
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
          keywords: formData.seo_keywords
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean),
        },
      };

      if (formData.hero_image_url) {
        payload.hero_image = {
          url: formData.hero_image_url,
          alt_text: formData.hero_image_alt,
          cdn_key: formData.hero_image_cdn_key,
        };
      }

      const url = category ? `/api/b2b/pim/categories/${category.category_id}` : "/api/b2b/pim/categories";
      const method = category ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(category ? "Category updated successfully" : "Category created successfully");
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save category");
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Failed to save category");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              {category ? "Edit Category" : "Create Category"}
            </h2>
            {parentCategory && (
              <p className="text-sm text-muted-foreground mt-1">Parent: {parentCategory.name}</p>
            )}
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setFormData({
                      ...formData,
                      name,
                      slug: formData.slug || generateSlug(name),
                    });
                  }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Water Meters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(event) => setFormData({ ...formData, slug: event.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="water-meters"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                rows={3}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Category description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Parent Category</label>
              <SearchableCategorySelect
                categories={categories}
                value={formData.parent_id || ""}
                onChange={(newValue) => setFormData({ ...formData, parent_id: newValue })}
                excludeCategoryId={category?.category_id}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Display Order</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(event) =>
                  setFormData({ ...formData, display_order: parseInt(event.target.value, 10) || 0 })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Hero Image</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    if (!file.type.startsWith("image/")) {
                      toast.error("Please select an image file");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be less than 5MB");
                      return;
                    }

                    try {
                      const uploadForm = new FormData();
                      uploadForm.append("image", file);

                      const response = await fetch("/api/b2b/editor/upload-image", {
                        method: "POST",
                        body: uploadForm,
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
                  onChange={(event) =>
                    setFormData({ ...formData, hero_image_url: event.target.value })
                  }
                  placeholder="Or paste image URL..."
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              {formData.hero_image_url && (
                <div className="relative w-full h-48 rounded overflow-hidden bg-muted border border-border">
                  <img src={formData.hero_image_url} alt="Hero preview" className="w-full h-full object-cover" />
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

              <input
                type="text"
                value={formData.hero_image_alt}
                onChange={(event) => setFormData({ ...formData, hero_image_alt: event.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Alt text for image"
              />
            </div>

            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground">SEO Settings</h4>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">SEO Title</label>
                <input
                  type="text"
                  value={formData.seo_title}
                  onChange={(event) => setFormData({ ...formData, seo_title: event.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="SEO optimized title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">SEO Description</label>
                <textarea
                  value={formData.seo_description}
                  onChange={(event) => setFormData({ ...formData, seo_description: event.target.value })}
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
                  onChange={(event) => setFormData({ ...formData, seo_keywords: event.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="is_active" className="text-sm text-foreground">
                Active (visible to customers)
              </label>
            </div>
          </div>

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
};

export default CategoryModal;
