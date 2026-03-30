"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Package, ExternalLink } from "lucide-react";
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
      setProductCount(data.brand.product_count || 0);
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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
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
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
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
              <div className="flex items-center gap-4 text-sm mt-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{productCount}</span>
                  <span className="text-muted-foreground">{t("pages.pim.brands.products")}</span>
                </div>
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
