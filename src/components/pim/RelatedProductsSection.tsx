"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Link2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ProductSearchModal } from "./ProductSearchModal";

type RelatedProduct = {
  entity_code: string;
  sku?: string;
  name?: Record<string, string>;
  cover_image_url?: string;
};

type Correlation = {
  correlation_id: string;
  target_entity_code: string;
  target_product: RelatedProduct;
};

type Props = {
  entityCode: string;
  defaultLanguageCode: string;
};

/**
 * Inline section to view, create and remove "related" product correlations for a
 * single product. Reuses the standard ProductSearchModal popup for picking targets
 * and talks directly to the existing /api/b2b/correlations endpoints.
 */
export function RelatedProductsSection({ entityCode, defaultLanguageCode }: Props) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const getName = useCallback(
    (name?: Record<string, string>) =>
      name?.[defaultLanguageCode] || name?.it || name?.en || Object.values(name || {})[0] || "—",
    [defaultLanguageCode]
  );

  const fetchCorrelations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/b2b/correlations?source_entity_code=${encodeURIComponent(entityCode)}&correlation_type=related&limit=100`
      );
      if (!res.ok) throw new Error("Failed to fetch correlations");
      const data = await res.json();
      setCorrelations(data.correlations || []);
    } catch (error) {
      console.error("Error fetching related products:", error);
    } finally {
      setLoading(false);
    }
  }, [entityCode]);

  useEffect(() => {
    fetchCorrelations();
  }, [fetchCorrelations]);

  async function handleAdd(entityCodes: string[]) {
    if (entityCodes.length === 0) return;
    setBusy(true);
    try {
      const results = await Promise.all(
        entityCodes.map((target_entity_code) =>
          fetch("/api/b2b/correlations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_entity_code: entityCode,
              target_entity_code,
              correlation_type: "related",
            }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.error(t("pages.pim.productDetail.relatedProducts.addFailed"));
      } else {
        toast.success(t("pages.pim.productDetail.relatedProducts.added", { count: String(entityCodes.length) }));
      }
      setShowAddModal(false);
      await fetchCorrelations();
    } catch (error) {
      console.error("Error adding related products:", error);
      toast.error(t("pages.pim.productDetail.relatedProducts.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(correlationId: string) {
    if (!confirm(t("pages.pim.productDetail.relatedProducts.removeConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/b2b/correlations/${correlationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete correlation");
      toast.success(t("pages.pim.productDetail.relatedProducts.removed"));
      await fetchCorrelations();
    } catch (error) {
      console.error("Error removing related product:", error);
      toast.error(t("pages.pim.productDetail.relatedProducts.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("pages.pim.productDetail.relatedProducts.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("pages.pim.productDetail.relatedProducts.description")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
        >
          <Plus className="h-4 w-4" />
          {t("pages.pim.productDetail.relatedProducts.add")}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("pages.pim.productDetail.loading")}
        </div>
      ) : correlations.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("pages.pim.productDetail.relatedProducts.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {correlations.map((c) => (
            <div
              key={c.correlation_id}
              className="flex items-center gap-3 rounded-lg border border-border p-2 hover:bg-muted/50 transition"
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                {c.target_product?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.target_product.cover_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[0.6rem] text-muted-foreground">N/A</span>
                )}
              </div>
              <Link
                href={`${tenantPrefix}/b2b/pim/products/${c.target_entity_code}`}
                className="group min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {getName(c.target_product?.name)}
                </p>
                <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  {c.target_entity_code}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(c.correlation_id)}
                disabled={busy}
                title={t("pages.pim.productDetail.relatedProducts.remove")}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ProductSearchModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSelect={handleAdd}
        excludeEntityCodes={[entityCode, ...correlations.map((c) => c.target_entity_code)]}
        title={t("pages.pim.productDetail.relatedProducts.addModalTitle")}
        description={t("pages.pim.productDetail.relatedProducts.addModalDescription")}
        selectButtonText={t("pages.pim.productDetail.relatedProducts.add")}
        multiSelect
      />
    </div>
  );
}
