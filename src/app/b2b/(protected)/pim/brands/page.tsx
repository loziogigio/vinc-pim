"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { toast } from "sonner";
import { FullScreenModal } from "@/components/shared/FullScreenModal";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { RichTextEditor } from "@/components/editor/RichTextEditor";

type Brand = {
  brand_id: string;
  label: string;
  slug: string;
  description?: string;
  logo_url?: string;
  mobile_logo_url?: string;
  website_url?: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export default function BrandsPage() {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterLogo, setFilterLogo] = useState<string>("all");
  const [sortBy, setSortBy] = useState("image_label");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    pages: number;
  } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    slug: "",
    description: "",
    logo_url: "",
    mobile_logo_url: "",
    website_url: "",
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchBrands();
  }, [search, filterActive, filterLogo, sortBy, sortOrder, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterActive, filterLogo, sortBy, sortOrder]);

  async function fetchBrands() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterActive !== "all") params.set("is_active", filterActive);
      if (filterLogo !== "all") params.set("has_logo", filterLogo);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/b2b/pim/brands?${params}`);
      const data = await res.json();
      setBrands(data.brands || []);
      setPagination(data.pagination || null);
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
      mobile_logo_url: "",
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
      mobile_logo_url: brand.mobile_logo_url || "",
      website_url: brand.website_url || "",
      is_active: brand.is_active,
      display_order: brand.display_order,
    });
    setShowModal(true);
  }

  async function handleSubmit() {

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
        toast.error(error.error || t("pages.pim.brands.saveFailed"));
        return;
      }

      toast.success(editingBrand ? t("pages.pim.brands.updateSuccess") : t("pages.pim.brands.createSuccess"));
      setShowModal(false);
      fetchBrands();
    } catch (error) {
      console.error("Failed to save brand:", error);
      toast.error(t("pages.pim.brands.saveFailed"));
    }
  }

  async function handleDelete(brandId: string, productCount: number) {
    if (productCount > 0) {
      toast.error(
        t("pages.pim.brands.hasProductsError", { count: productCount })
      );
      return;
    }

    if (!confirm(t("pages.pim.brands.deleteConfirm"))) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/brands/${brandId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t("pages.pim.brands.deleteFailed"));
        return;
      }

      toast.success(t("pages.pim.brands.deleteSuccess"));
      fetchBrands();
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error(t("pages.pim.brands.deleteFailed"));
    }
  }

  function renderPagination() {
    if (!pagination || pagination.pages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-card shadow-sm border border-border">
        <p className="text-sm text-muted-foreground">
          {t("pages.pim.brands.showingOf", {
            from: (pagination.page - 1) * pagination.limit + 1,
            to: Math.min(pagination.page * pagination.limit, pagination.total),
            total: pagination.total,
          })}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.previous")}
          </button>
          {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
            let pageNum: number;
            if (pagination.pages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= pagination.pages - 3) {
              pageNum = pagination.pages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  pageNum === page
                    ? "bg-primary text-primary-foreground"
                    : "border border-input hover:bg-accent"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= pagination.pages}
            className="px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.next")}
          </button>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold text-foreground">{t("pages.pim.brands.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("pages.pim.brands.subtitle")}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          {t("pages.pim.brands.newBrand")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("pages.pim.brands.searchPlaceholder")}
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
          <option value="all">{t("pages.pim.brands.allStatus")}</option>
          <option value="true">{t("common.active")}</option>
          <option value="false">{t("common.inactive")}</option>
        </select>

        <select
          value={filterLogo}
          onChange={(e) => setFilterLogo(e.target.value)}
          className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{t("pages.pim.brands.allImages")}</option>
          <option value="true">{t("pages.pim.brands.withImage")}</option>
          <option value="false">{t("pages.pim.brands.withoutImage")}</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="image_label">{t("pages.pim.brands.sortImageLabel")}</option>
          <option value="label">{t("pages.pim.brands.sortName")}</option>
          <option value="created_at">{t("pages.pim.brands.sortCreated")}</option>
          <option value="updated_at">{t("pages.pim.brands.sortUpdated")}</option>
          <option value="product_count">{t("pages.pim.brands.sortProductCount")}</option>
          <option value="display_order">{t("pages.pim.brands.sortDisplayOrder")}</option>
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
          {t("pages.pim.brands.loading")}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t("pages.pim.brands.noFound")}</p>
          <button
            onClick={openCreateModal}
            className="text-primary hover:underline"
          >
            {t("pages.pim.brands.createFirst")}
          </button>
        </div>
      ) : (
        <>
        {renderPagination()}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("pages.pim.brands.colBrand")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("pages.pim.brands.colSlug")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("pages.pim.products.title")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("common.status")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("common.createdAt")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("common.actions")}
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
                      {brand.is_active ? t("common.active") : t("common.inactive")}
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
                        title={t("common.view")}
                      >
                        {t("common.view")}
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

      {renderPagination()}
      </>
      )}

      {/* Modal */}
      <FullScreenModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingBrand ? t("pages.pim.brands.editBrand") : t("pages.pim.brands.createBrand")}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!formData.label || !formData.slug}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 text-sm"
            >
              {editingBrand ? t("pages.pim.brands.updateBrand") : t("pages.pim.brands.createBrand")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.brands.brandName")} *</label>
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
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
                placeholder="e.g., Nike, Apple, Samsung"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.brands.colSlug")} *</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setFormData({ ...formData, slug: e.target.value });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
                placeholder="e.g., nike, apple, samsung"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.pim.brands.slugHint")}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("common.description")}</label>
            <RichTextEditor
              content={formData.description}
              onChange={(html) => setFormData({ ...formData, description: html })}
              placeholder="Brief description of the brand..."
              minHeight="120px"
            />
          </div>

          {/* Brand Logo */}
          <ImageUpload
            label={t("pages.pim.brands.brandLogo")}
            value={formData.logo_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, logo_url: url }))}
          />

          {/* Mobile Brand Logo */}
          <ImageUpload
            label={t("pages.pim.brands.mobileBrandLogo")}
            value={formData.mobile_logo_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, mobile_logo_url: url }))}
          />

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.brands.websiteUrl")}</label>
            <input
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
              placeholder="https://..."
            />
          </div>

          {/* Display Order & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.brands.displayOrder")}</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                {t("common.active")}
              </label>
            </div>
          </div>
        </div>
      </FullScreenModal>
    </div>
  );
}
