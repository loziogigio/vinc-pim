"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CmsAdminClient, type CmsAdminAdapter } from "vinc-cms-admin";
import { useTranslation } from "@/lib/i18n/useTranslation";

/** Builds the CS-side adapter for one storefront. Client component hook. */
export function useCsCmsAdapter(
  storefrontSlug: string,
  tenantPrefix: string
): Partial<CmsAdminAdapter> {
  const { t } = useTranslation();
  const [storefrontUrl, setStorefrontUrl] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/b2b/b2c/storefronts/${storefrontSlug}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const { data } = await res.json();
        const domains: Array<{ domain: string; is_primary?: boolean }> =
          data?.domains ?? [];
        const primary = domains.find((d) => d.is_primary) ?? domains[0];
        if (primary && !cancelled) {
          const raw = primary.domain;
          setStorefrontUrl(raw.startsWith("http") ? raw : `https://${raw}`);
        }
      } catch {
        /* preview stays unconfigured */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storefrontSlug]);

  return useMemo(
    () => ({
      client: new CmsAdminClient({
        apiBase: `/api/b2b/b2c/storefronts/${storefrontSlug}`,
      }),
      t,
      links: {
        pagesList: `${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}/pages`,
        pageBuilder: (p: string) =>
          `${tenantPrefix}/b2b/b2c-page-builder?storefront=${storefrontSlug}&page=${p}`,
        homeBuilder: `${tenantPrefix}/b2b/b2c-home-builder?storefront=${storefrontSlug}`,
        dashboard: `${tenantPrefix}/b2b/b2c`,
      },
      previewUrl: ({ pageSlug }: { pageSlug?: string }) =>
        storefrontUrl
          ? `${storefrontUrl}?preview=true${pageSlug ? `&page=${pageSlug}` : ""}`
          : undefined,
      LinkComponent: Link as CmsAdminAdapter["LinkComponent"],
      // uploadImage & searchProducts: package defaults already hit CS's
      // /api/uploads and /api/search/search
    }),
    [storefrontSlug, tenantPrefix, t, storefrontUrl]
  );
}
