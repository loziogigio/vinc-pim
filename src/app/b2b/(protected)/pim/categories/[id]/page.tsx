"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FolderTree } from "lucide-react";
import CategoryModal, { CategoryRecord } from "../_components/category-modal";
import {
  ProductAssociationSection,
  ProductAssociationConfig,
} from "@/components/pim/ProductAssociationSection";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { getLocalizedString } from "@/lib/types/pim";

type Category = CategoryRecord & {
  product_count: number;
  created_at: string;
  updated_at: string;
};

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params?.id as string;
  const { t } = useTranslation();

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCategories, setEditCategories] = useState<CategoryRecord[]>([]);
  const [editParentCategory, setEditParentCategory] = useState<CategoryRecord | null>(null);

  useEffect(() => {
    if (categoryId) {
      fetchCategory();
    }
  }, [categoryId]);

  async function fetchCategory() {
    try {
      const res = await fetch(`/api/b2b/pim/categories/${categoryId}`);
      if (!res.ok) throw new Error("Failed to fetch category");
      const data = await res.json();
      setCategory(data.category);
      setProductCount(data.category.product_count || 0);
    } catch (error) {
      console.error("Failed to fetch category:", error);
      toast.error(t("pages.pim.categories.loadFailed"));
      router.push("/b2b/pim/categories");
    } finally {
      setLoading(false);
    }
  }

  async function openEditModal() {
    try {
      setEditCategories([]);
      setEditParentCategory(null);
      const res = await fetch("/api/b2b/pim/categories?include_inactive=true");
      if (!res.ok) throw new Error("Failed to load categories");

      const data = await res.json();
      setEditCategories(data.categories);

      if (category?.parent_id) {
        const parent = data.categories.find(
          (cat: CategoryRecord) => cat.category_id === category.parent_id
        );
        setEditParentCategory(parent || null);
      } else {
        setEditParentCategory(null);
      }

      setShowEditModal(true);
    } catch (error) {
      console.error("Failed to load categories for editing:", error);
      toast.error(t("pages.pim.categories.loadCategoriesForEditFailed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t("pages.pim.categories.categoryNotFound")}</div>
      </div>
    );
  }

  const productAssociationConfig: ProductAssociationConfig = {
    fetchProductsUrl: `/api/b2b/pim/categories/{id}/products`,
    addProductsUrl: `/api/b2b/pim/categories/{id}/products`,
    removeProductsUrl: `/api/b2b/pim/categories/{id}/products`,
    importUrl: `/api/b2b/pim/categories/{id}/import`,
    exportUrl: `/api/b2b/pim/categories/{id}/export`,
    title: t("pages.pim.common.associatedProducts"),
    description: `${productCount} products`,
    emptyMessage: t("pages.pim.categories.noProductsAssociated"),
    addButtonText: t("pages.pim.common.addProducts"),
    addModalTitle: t("pages.pim.categories.addProductsToCategory"),
    addModalDescription: t("pages.pim.categories.addProductsDescription", { name: getLocalizedString(category.name) }),
    exportFilename: `category-${category.slug}-products.csv`,
    addRequestActionField: "action",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/b2b/pim/categories"
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <FolderTree className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                {getLocalizedString(category.name)}
              </h1>
              <span className={`rounded-full px-3 py-1 text-sm ${
                category.is_active
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {category.is_active ? t("common.active") : t("common.inactive")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <span>{productCount} {t("pages.pim.categories.products")}</span>
              <span className="mx-1">|</span>
              <span>{t("pages.pim.categories.slugLabel")}: {category.slug}</span>
              <span className="mx-1">|</span>
              <span>{t("pages.pim.categories.levelLabel")}: {category.level}</span>
              {typeof category.child_count === "number" && (
                <>
                  <span className="mx-1">|</span>
                  <span>{t("pages.pim.categories.childrenLabel")}: {category.child_count}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={openEditModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm"
          type="button"
        >
          {t("pages.pim.categories.editCategory")}
        </button>
      </div>

      {/* Category Details */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("pages.pim.categories.categoryDetails")}</h2>
              {category.parent_id && (
                <button
                  onClick={() => router.push(`/b2b/pim/categories/${category.parent_id}`)}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("pages.pim.categories.viewParent")}
                </button>
              )}
            </div>
            {category.description && (
              <p className="text-sm leading-6 text-muted-foreground">{getLocalizedString(category.description, "")}</p>
            )}
            <dl className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">{t("pages.pim.categories.displayOrder")}</dt>
                <dd>{category.display_order}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("pages.pim.categories.updatedLabel")}</dt>
                <dd>{new Date(category.updated_at).toLocaleString()}</dd>
              </div>
              {category.seo?.title && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-foreground">{t("pages.pim.categories.seoTitle")}</dt>
                  <dd>{getLocalizedString(category.seo.title)}</dd>
                </div>
              )}
              {category.seo?.description && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-foreground">{t("pages.pim.categories.seoDescription")}</dt>
                  <dd>{getLocalizedString(category.seo.description)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {category.hero_image?.url && (
          <div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{t("pages.pim.categories.heroImage")}</h2>
              <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={category.hero_image.url}
                  alt={category.hero_image.alt_text || getLocalizedString(category.name)}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Products Section */}
      <ProductAssociationSection
        entityId={categoryId}
        config={productAssociationConfig}
        onProductCountChange={setProductCount}
      />

      {/* Edit Category Modal */}
      {showEditModal && category && (
        <CategoryModal
          category={category}
          parentCategory={editParentCategory}
          categories={editCategories}
          onClose={() => {
            setShowEditModal(false);
            setEditParentCategory(null);
            setEditCategories([]);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditParentCategory(null);
            setEditCategories([]);
            fetchCategory();
          }}
        />
      )}
    </div>
  );
}
