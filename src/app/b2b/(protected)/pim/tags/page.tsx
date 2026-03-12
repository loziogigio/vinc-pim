"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, ExternalLink, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { toast } from "sonner";
import { FullScreenModal } from "@/components/shared/FullScreenModal";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { RichTextEditor } from "@/components/editor/RichTextEditor";

type TagRecord = {
  tag_id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  image?: { url: string; alt_text?: string; cdn_key?: string };
  mobile_image?: { url: string; alt_text?: string; cdn_key?: string };
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export default function TagsPage() {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [sortBy, setSortBy] = useState("display_order");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagRecord | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    color: "",
    image_url: "",
    image_alt: "",
    mobile_image_url: "",
    mobile_image_alt: "",
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterActive, sortBy, sortOrder]);

  async function fetchTags() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterActive !== "all") params.set("is_active", filterActive);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);

      const res = await fetch(`/api/b2b/pim/tags?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch tags");
      }
      const data = await res.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingTag(null);
    setSlugManuallyEdited(false);
    setFormData({
      name: "",
      slug: "",
      description: "",
      color: "",
      image_url: "",
      image_alt: "",
      mobile_image_url: "",
      mobile_image_alt: "",
      is_active: true,
      display_order: 0,
    });
    setShowModal(true);
  }

  function openEditModal(tag: TagRecord) {
    setEditingTag(tag);
    setSlugManuallyEdited(true);
    setFormData({
      name: tag.name,
      slug: tag.slug,
      description: tag.description || "",
      color: tag.color || "",
      image_url: tag.image?.url || "",
      image_alt: tag.image?.alt_text || "",
      mobile_image_url: tag.mobile_image?.url || "",
      mobile_image_alt: tag.mobile_image?.alt_text || "",
      is_active: tag.is_active,
      display_order: tag.display_order,
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    try {
      const url = editingTag
        ? `/api/b2b/pim/tags/${editingTag.tag_id}`
        : "/api/b2b/pim/tags";
      const method = editingTag ? "PATCH" : "POST";

      const payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        color: formData.color,
        is_active: formData.is_active,
        display_order: formData.display_order,
        image: formData.image_url
          ? { url: formData.image_url, alt_text: formData.image_alt || undefined }
          : undefined,
        mobile_image: formData.mobile_image_url
          ? { url: formData.mobile_image_url, alt_text: formData.mobile_image_alt || undefined }
          : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to save tag");
        return;
      }

      toast.success(editingTag ? "Tag updated successfully" : "Tag created successfully");
      setShowModal(false);
      fetchTags();
    } catch (error) {
      console.error("Failed to save tag:", error);
      toast.error("Failed to save tag");
    }
  }

  async function handleDelete(tagId: string, productCount: number) {
    if (productCount > 0) {
      toast.error(
        `Cannot delete tag with ${productCount} associated products. Remove the tag from products first.`
      );
      return;
    }

    if (!confirm("Are you sure you want to delete this tag?")) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/tags/${tagId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to delete tag");
        return;
      }

      toast.success("Tag deleted successfully");
      fetchTags();
    } catch (error) {
      console.error("Failed to delete tag:", error);
      toast.error("Failed to delete tag");
    }
  }

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.pim.tags.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.pim.tags.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          {t("pages.pim.tags.newTag")}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("pages.pim.tags.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterActive}
              onChange={(event) => setFilterActive(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="display_order">Display order</option>
              <option value="name">Name</option>
              <option value="product_count">Product count</option>
              <option value="created_at">Created date</option>
            </select>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t("pages.pim.tags.directory")}</h2>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            {t("pages.pim.tags.loading")}
          </div>
        ) : tags.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            {t("pages.pim.tags.noFound")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tags.map((tag) => (
              <div
                key={tag.tag_id}
                className={`flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between ${
                  !tag.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <TagIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{tag.name}</h3>
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
                    <p className="text-xs text-muted-foreground">{tag.slug}</p>
                    {tag.description && (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {tag.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>Products: {tag.product_count}</span>
                      <span>Display order: {tag.display_order}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/b2b/pim/tags/${tag.tag_id}`}
                    className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditModal(tag)}
                    className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-muted transition"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tag.tag_id, tag.product_count)}
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

      <FullScreenModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingTag ? t("pages.pim.tags.editTag") : t("pages.pim.tags.createTag")}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!formData.name || !formData.slug}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 text-sm"
            >
              {editingTag ? t("pages.pim.tags.updateTag") : t("pages.pim.tags.createTag")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Define standardized tags to reuse across your catalog.
          </p>

          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
              <input
                value={formData.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    slug: slugManuallyEdited ? prev.slug : generateSlug(name),
                  }));
                }}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Seasonal Promotion"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Slug *</label>
              <input
                value={formData.slug}
                onChange={(event) => {
                  setSlugManuallyEdited(true);
                  setFormData((prev) => ({ ...prev, slug: event.target.value }));
                }}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="seasonal-promotion"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <RichTextEditor
              content={formData.description}
              onChange={(html) => setFormData((prev) => ({ ...prev, description: html }))}
              placeholder="Used for highlighting seasonal or thematic assortments."
              minHeight="120px"
            />
          </div>

          {/* Desktop Image */}
          <ImageUpload
            label="Tag Image"
            value={formData.image_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, image_url: url }))}
          />
          {formData.image_url && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Image Alt Text</label>
              <input
                value={formData.image_alt}
                onChange={(e) => setFormData((prev) => ({ ...prev, image_alt: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Descriptive alt text..."
              />
            </div>
          )}

          {/* Mobile Image */}
          <ImageUpload
            label="Mobile Tag Image"
            value={formData.mobile_image_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, mobile_image_url: url }))}
          />
          {formData.mobile_image_url && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Mobile Image Alt Text</label>
              <input
                value={formData.mobile_image_alt}
                onChange={(e) => setFormData((prev) => ({ ...prev, mobile_image_alt: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Descriptive alt text..."
              />
            </div>
          )}

          {/* Display Order & Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Display Order</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, display_order: Number(event.target.value) }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Color (hex or CSS value)</label>
              <input
                value={formData.color}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, color: event.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="#ff6f61"
              />
            </div>
          </div>

          {/* Active */}
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, is_active: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            Active (visible in product pickers)
          </label>
        </div>
      </FullScreenModal>
    </div>
  );
}
