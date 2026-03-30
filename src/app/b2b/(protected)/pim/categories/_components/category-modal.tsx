"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FullScreenModal } from "@/components/shared/FullScreenModal";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { ChannelSelect } from "@/components/shared/ChannelSelect";
import { SearchableCategorySelect, type CategoryRecord } from "@/components/pim/SearchableCategorySelect";
import { useTranslation } from "@/lib/i18n/useTranslation";

export type { CategoryRecord };

type CategoryModalProps = {
  category: CategoryRecord | null;
  parentCategory: CategoryRecord | null;
  categories: CategoryRecord[];
  onClose: () => void;
  onSuccess: () => void;
};

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function buildPayload(formData: ReturnType<typeof getInitialFormData>, category: CategoryRecord | null) {
  const isRoot = !formData.parent_id;
  const payload: Record<string, any> = {
    name: formData.name,
    slug: formData.slug,
    description: formData.description,
    parent_id: formData.parent_id || undefined,
    display_order: formData.display_order,
    is_active: formData.is_active,
    ...(isRoot ? { channel_code: formData.channel_code || null } : {}),
    seo: {
      title: formData.seo_title,
      description: formData.seo_description,
      keywords: formData.seo_keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    },
    hero_image: formData.hero_image_url
      ? { url: formData.hero_image_url, alt_text: formData.hero_image_alt, cdn_key: formData.hero_image_cdn_key }
      : null,
    mobile_hero_image: formData.mobile_hero_image_url
      ? { url: formData.mobile_hero_image_url, alt_text: formData.mobile_hero_image_alt, cdn_key: formData.mobile_hero_image_cdn_key }
      : null,
  };
  return payload;
}

function getInitialFormData(category: CategoryRecord | null, parentCategory: CategoryRecord | null) {
  return {
    name: category?.name || "",
    slug: category?.slug || "",
    description: category?.description || "",
    parent_id: category?.parent_id || parentCategory?.category_id || "",
    hero_image_url: category?.hero_image?.url || "",
    hero_image_alt: category?.hero_image?.alt_text || "",
    hero_image_cdn_key: category?.hero_image?.cdn_key || "",
    mobile_hero_image_url: category?.mobile_hero_image?.url || "",
    mobile_hero_image_alt: category?.mobile_hero_image?.alt_text || "",
    mobile_hero_image_cdn_key: category?.mobile_hero_image?.cdn_key || "",
    seo_title: category?.seo?.title || "",
    seo_description: category?.seo?.description || "",
    seo_keywords: category?.seo?.keywords?.join(", ") || "",
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true,
    channel_code: category?.channel_code || "",
  };
}

const INPUT_CLASS = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

const CategoryModal = ({
  category,
  parentCategory,
  categories,
  onClose,
  onSuccess,
}: CategoryModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(() => getInitialFormData(category, parentCategory));
  const [isSaving, setIsSaving] = useState(false);

  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    setIsSaving(true);
    try {
      const payload = buildPayload(formData, category);
      const url = category ? `/api/b2b/pim/categories/${category.category_id}` : "/api/b2b/pim/categories";

      const response = await fetch(url, {
        method: category ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(category ? t("pages.pim.categories.updateSuccess") : t("pages.pim.categories.createSuccess"));
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || t("pages.pim.categories.saveFailed"));
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error(t("pages.pim.categories.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const modalTitle = category
    ? category.parent_id ? t("pages.pim.categories.editCategoryTitle") : t("pages.pim.categories.editRootCategory")
    : parentCategory ? t("pages.pim.categories.newChildOf", { name: parentCategory.name }) : t("pages.pim.categories.createRootCategory");

  const canSubmit = !isSaving && formData.name && formData.slug && (formData.parent_id || formData.channel_code);

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={modalTitle}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 text-sm"
          >
            {isSaving ? t("pages.pim.categories.savingBtn") : category ? t("common.update") : t("common.create")}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Root category: channel selection */}
        {!formData.parent_id && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t("pages.pim.categories.rootCategory")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.pim.categories.rootCategoryDesc")}
              </p>
            </div>
            <ChannelSelect
              value={formData.channel_code}
              onChange={(code) => updateField("channel_code", code)}
              label={t("pages.pim.categories.salesChannel")}
              required
            />
          </div>
        )}

        {/* Child category: show parent info */}
        {formData.parent_id && parentCategory && (
          <p className="text-sm text-muted-foreground">Parent: {parentCategory.name}</p>
        )}

        {/* Name & Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.nameLabel")} *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  name,
                  slug: prev.slug || generateSlug(name),
                }));
              }}
              className={INPUT_CLASS}
              placeholder={!formData.parent_id ? "e.g. Prodotti, Categorie" : "e.g. Bicchieri, Posate"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.slugFieldLabel")} *</label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              className={INPUT_CLASS}
              placeholder={!formData.parent_id ? "e.g. prodotti, categorie" : "e.g. bicchieri, posate"}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.descriptionLabel")}</label>
          <RichTextEditor
            content={formData.description}
            onChange={(html) => updateField("description", html)}
            placeholder="Category description..."
            minHeight="120px"
          />
        </div>

        {/* Parent Category — only show when editing (to allow reparenting) */}
        {category && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.parentCategoryLabel")}</label>
            <SearchableCategorySelect
              categories={categories}
              value={formData.parent_id || ""}
              onChange={(v) => updateField("parent_id", v)}
              excludeCategoryId={category.category_id}
            />
          </div>
        )}

        {/* Display Order & Active */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.displayOrder")}</label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => updateField("display_order", parseInt(e.target.value, 10) || 0)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              {t("pages.pim.categories.activeVisible")}
            </label>
          </div>
        </div>

        {/* Hero Image */}
        <ImageUpload
          label={t("pages.pim.categories.heroImage")}
          value={formData.hero_image_url}
          onChange={(url) => setFormData((prev) => ({ ...prev, hero_image_url: url, hero_image_cdn_key: "" }))}
        />
        {formData.hero_image_url && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.imageAltText")}</label>
            <input
              type="text"
              value={formData.hero_image_alt}
              onChange={(e) => updateField("hero_image_alt", e.target.value)}
              className={INPUT_CLASS}
              placeholder="Alt text for image"
            />
          </div>
        )}

        {/* Mobile Hero Image */}
        <ImageUpload
          label={t("pages.pim.categories.mobileHeroImage")}
          value={formData.mobile_hero_image_url}
          onChange={(url) => setFormData((prev) => ({ ...prev, mobile_hero_image_url: url, mobile_hero_image_cdn_key: "" }))}
        />
        {formData.mobile_hero_image_url && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.mobileImageAltText")}</label>
            <input
              type="text"
              value={formData.mobile_hero_image_alt}
              onChange={(e) => updateField("mobile_hero_image_alt", e.target.value)}
              className={INPUT_CLASS}
              placeholder="Alt text for mobile image"
            />
          </div>
        )}

        {/* SEO Fields */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="font-semibold text-foreground">{t("pages.pim.categories.seoSettings")}</h4>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.seoTitle")}</label>
            <input
              type="text"
              value={formData.seo_title}
              onChange={(e) => updateField("seo_title", e.target.value)}
              className={INPUT_CLASS}
              placeholder="SEO optimized title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.seoDescription")}</label>
            <textarea
              value={formData.seo_description}
              onChange={(e) => updateField("seo_description", e.target.value)}
              rows={2}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="SEO meta description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("pages.pim.categories.seoKeywords")}</label>
            <input
              type="text"
              value={formData.seo_keywords}
              onChange={(e) => updateField("seo_keywords", e.target.value)}
              className={INPUT_CLASS}
              placeholder="keyword1, keyword2, keyword3"
            />
          </div>
        </div>
      </div>
    </FullScreenModal>
  );
};

export default CategoryModal;
