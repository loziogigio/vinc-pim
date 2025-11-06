"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, ExternalLink, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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

export default function TagsPage() {
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
      is_active: tag.is_active,
      display_order: tag.display_order,
    });
    setShowModal(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const url = editingTag
        ? `/api/b2b/pim/tags/${editingTag.tag_id}`
        : "/api/b2b/pim/tags";
      const method = editingTag ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
          <h1 className="text-2xl font-bold text-foreground">Tags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create reusable tags to organize and segment your catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          New Tag
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tags by name or slug..."
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
          <h2 className="text-lg font-semibold text-foreground">Tag Directory</h2>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            Loading tags...
          </div>
        ) : tags.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            No tags found. Create your first tag to get started.
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {editingTag ? "Edit Tag" : "Create Tag"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Define standardized tags to reuse across your catalog.
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-6">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Name *
                    </label>
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
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
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
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      placeholder="seasonal-promotion"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, description: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                    placeholder="Used for highlighting seasonal or thematic assortments."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,200px)]">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          display_order: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Color (hex or CSS value)
                    </label>
                    <input
                      value={formData.color}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, color: event.target.value }))
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      placeholder="#ff6f61"
                    />
                  </div>
                </div>

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

              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded border border-border hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90 transition"
                >
                  {editingTag ? "Update Tag" : "Create Tag"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
