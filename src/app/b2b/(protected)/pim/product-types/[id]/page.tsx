"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Cpu } from "lucide-react";
import {
  ProductAssociationSection,
  ProductAssociationConfig,
} from "@/components/pim/ProductAssociationSection";
import { getLocalizedString, type MultiLangString } from "@/lib/types/pim";
import { useTranslation } from "@/lib/i18n/useTranslation";

type ProductTypeFeature = {
  feature_id: string;
  required: boolean;
  display_order: number;
};

type ProductType = {
  product_type_id: string;
  code?: string;
  name: MultiLangString;
  slug: string;
  description?: MultiLangString;
  features?: ProductTypeFeature[];
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
};

export default function ProductTypeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productTypeId = params?.id as string;
  const { t } = useTranslation();

  const [productType, setProductType] = useState<ProductType | null>(null);
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    if (productTypeId) fetchProductType();
  }, [productTypeId]);

  async function fetchProductType() {
    try {
      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}`);
      if (!res.ok) throw new Error("Failed to fetch product type");
      const data = await res.json();
      setProductType(data.productType);
      setProductCount(data.productType.product_count || 0);
    } catch (error) {
      console.error("Failed to fetch product type:", error);
      toast.error(t("pages.pim.productTypes.loadFailed"));
      router.push("/b2b/pim/product-types");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{t("pages.pim.productTypes.loading")}</div>
      </div>
    );
  }

  if (!productType) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{t("pages.pim.productTypes.productTypeNotFound")}</div>
      </div>
    );
  }

  const productAssociationConfig: ProductAssociationConfig = {
    fetchProductsUrl: `/api/b2b/pim/product-types/{id}/products`,
    addProductsUrl: `/api/b2b/pim/product-types/{id}/products`,
    removeProductsUrl: `/api/b2b/pim/product-types/{id}/products`,
    syncUrl: `/api/b2b/pim/product-types/{id}/sync`,
    importUrl: `/api/b2b/pim/product-types/{id}/import`,
    exportUrl: `/api/b2b/pim/product-types/{id}/export`,
    title: t("pages.pim.common.associatedProducts"),
    description: t("pages.pim.productTypes.associatedProductsDesc", { count: productCount }),
    emptyMessage: t("pages.pim.productTypes.associatedProductsEmpty"),
    addButtonText: t("pages.pim.common.addProducts"),
    addModalTitle: t("pages.pim.productTypes.addProductsToTypeTitle"),
    addModalDescription: t("pages.pim.productTypes.addProductsToTypeDesc", { name: getLocalizedString(productType.name) }),
    exportFilename: `product-type-${productType.slug}-products.csv`,
    addRequestActionField: "action",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/b2b/pim/product-types"
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <Cpu className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                {getLocalizedString(productType.name)}
              </h1>
              {productType.code && (
                <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-mono font-medium text-primary">
                  {productType.code}
                </span>
              )}
              {!productType.is_active && (
                <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  {t("pages.pim.productTypes.inactiveBadge")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
              <span>{t("pages.pim.productTypes.slugLabel", { slug: productType.slug })}</span>
              <span>{t("pages.pim.productTypes.productsLabel", { count: productCount })}</span>
              <span>{t("pages.pim.productTypes.featuresLabel", { count: productType.features?.length || 0 })}</span>
              <span className={productType.is_active ? "text-green-600" : "text-red-600"}>
                {productType.is_active ? t("pages.pim.productTypes.activeLabel") : t("pages.pim.productTypes.inactiveLabel")}
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/b2b/pim/product-types/${productTypeId}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          {t("pages.pim.productTypes.editProductType")}
        </Link>
      </div>

      {/* Details + Features */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("pages.pim.productTypes.productTypeDetails")}
            </h2>
            {productType.description && (
              <p className="text-sm leading-6 text-muted-foreground">
                {getLocalizedString(productType.description)}
              </p>
            )}
            <dl className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">{t("pages.pim.productTypes.codeErp")}</dt>
                <dd className="font-mono">{productType.code || "\u2014"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("pages.pim.productTypes.displayOrderLabel")}</dt>
                <dd>{productType.display_order}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("pages.pim.productTypes.updatedLabel")}</dt>
                <dd>{new Date(productType.updated_at).toLocaleString()}</dd>
              </div>
            </dl>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("pages.pim.productTypes.assignedFeatures")}</h3>
              {productType.features && productType.features.length > 0 ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {productType.features.map((feature) => (
                    <li
                      key={feature.feature_id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
                    >
                      <span>{t("pages.pim.productTypes.featureId", { id: feature.feature_id })}</span>
                      <span>
                        {t("pages.pim.productTypes.featureOrder", { order: feature.display_order })} {"\u2022"} {feature.required ? t("pages.pim.productTypes.featureRequired") : t("pages.pim.productTypes.featureOptional")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("pages.pim.productTypes.noFeaturesAssigned")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {t("pages.pim.common.quickActions")}
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <button
                onClick={() => router.push("/b2b/pim/features")}
                className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted transition"
              >
                {t("pages.pim.productTypes.manageTechnicalFeatures")}
              </button>
              <button
                onClick={() => router.push(`/b2b/pim/product-types/${productTypeId}/edit`)}
                className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted transition"
              >
                {t("pages.pim.productTypes.editProductType")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <ProductAssociationSection
        entityId={productTypeId}
        config={productAssociationConfig}
        onProductCountChange={setProductCount}
      />
    </div>
  );
}
