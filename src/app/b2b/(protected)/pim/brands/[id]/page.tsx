"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Package, ExternalLink, Info } from "lucide-react";
import {
  ProductAssociationSection,
  ProductAssociationConfig,
} from "@/components/pim/ProductAssociationSection";
import { useTranslation } from "@/lib/i18n/useTranslation";

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

export default function BrandDetailPage() {
  const router = useRouter();
  const params = useParams();
  const brandId = params?.id as string;
  const { t } = useTranslation();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [counts, setCounts] = useState<{
    published: number;
    searchable: number;
    variant_parents: number;
    drafts: number;
    by_channel: { channel: string | null; count: number }[];
  } | null>(null);

  useEffect(() => {
    if (brandId) {
      fetchBrand();
    }
  }, [brandId]);

  async function fetchBrand() {
    try {
      const res = await fetch(`/api/b2b/pim/brands/${brandId}`);
      if (!res.ok) throw new Error("Failed to fetch brand");
      const data = await res.json();
      setBrand(data.brand);
      setCounts(data.counts ?? null);
      setProductCount(data.counts?.published ?? data.brand.product_count ?? 0);
    } catch (error) {
      console.error("Failed to fetch brand:", error);
      toast.error(t("pages.pim.brands.loadFailed"));
      router.push("/b2b/pim/brands");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{t("pages.pim.brands.brandNotFound")}</div>
      </div>
    );
  }

  const productAssociationConfig: ProductAssociationConfig = {
    fetchProductsUrl: `/api/b2b/pim/brands/{id}/products`,
    addProductsUrl: `/api/b2b/pim/brands/{id}/products`,
    removeProductsUrl: `/api/b2b/pim/brands/{id}/products`,
    importUrl: `/api/b2b/pim/brands/{id}/import`,
    exportUrl: `/api/b2b/pim/brands/{id}/export`,
    title: t("pages.pim.common.associatedProducts"),
    description: `${productCount} products`,
    emptyMessage: t("pages.pim.brands.noProductsAssociated"),
    addButtonText: t("pages.pim.common.addProducts"),
    addModalTitle: t("pages.pim.brands.addProductsToBrand"),
    addModalDescription: t("pages.pim.brands.addProductsDescription", { name: brand.label }),
    exportFilename: `brand-${brand.slug}-products.csv`,
    addRequestActionField: "action",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/b2b/pim/brands"
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-start gap-4">
            {brand.logo_url && (
              <img
                src={brand.logo_url}
                alt={brand.label}
                className="w-16 h-16 object-contain border border-border rounded-lg p-2 bg-muted"
              />
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {brand.label}
                </h1>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    brand.is_active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300"
                  }`}
                >
                  {brand.is_active ? t("common.active") : t("common.inactive")}
                </span>
              </div>
              {brand.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {brand.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{counts?.published ?? productCount}</span>
                  <span className="text-muted-foreground">{t("pages.pim.brands.published")}</span>
                </div>
                {counts && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span>
                      <span className="text-foreground font-medium">{counts.searchable}</span>{" "}
                      <span className="text-muted-foreground">{t("pages.pim.brands.shownInSearch")}</span>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-foreground font-medium">{counts.variant_parents}</span>{" "}
                      <span className="text-muted-foreground">{t("pages.pim.brands.variantParentsGrouped")}</span>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" title={t("pages.pim.brands.countsHelp")} />
                    </span>
                    {counts.drafts > 0 && (
                      <span className="text-muted-foreground">
                        · {t("pages.pim.brands.draftsNote", { count: counts.drafts })}
                      </span>
                    )}
                  </>
                )}
                {brand.website_url && (
                  <a
                    href={brand.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t("pages.pim.brands.website")}
                  </a>
                )}
              </div>
              {counts && counts.by_channel.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1.5">
                  <span className="font-medium">{t("pages.pim.brands.inSearchByChannel")}:</span>
                  {counts.by_channel.map((c, i) => (
                    <span key={c.channel ?? "untagged"} className="inline-flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/60">·</span>}
                      <span className="text-foreground font-medium">
                        {c.channel ?? t("pages.pim.brands.untaggedChannel")}
                      </span>
                      <span>{c.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <ProductAssociationSection
        entityId={brandId}
        config={productAssociationConfig}
        onProductCountChange={setProductCount}
      />
    </div>
  );
}
