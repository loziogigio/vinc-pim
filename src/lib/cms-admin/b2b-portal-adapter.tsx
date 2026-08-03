"use client";
import { useMemo } from "react";
import { CmsAdminClient } from "vinc-cms-admin";
import type { CmsAdminAdapter } from "vinc-cms-admin/react";
import { useTranslation } from "@/lib/i18n/useTranslation";

const B2C_FORMS_PREFIX = "pages.b2c.formSubmissions.";
const B2B_FORMS_PREFIX = "pages.b2bPortal.formSubmissions.";

/**
 * CS-side adapter for one B2B portal, so the portal Forms page can mount the
 * packaged SubmissionsInbox instead of maintaining its own fork.
 *
 * The packaged inbox hard-codes `pages.b2c.formSubmissions.*` keys. The B2B admin
 * has its own equally-shaped `pages.b2bPortal.formSubmissions.*` block, so `t` is
 * wrapped to try the B2B key first. CS's createT resolves locale → en → the key
 * itself, returning the key unchanged on a total miss without throwing, so an
 * unchanged result is a reliable "not translated here" signal and we fall back to
 * the original b2c key.
 */
export function useB2BPortalCmsAdapter(slug: string): Partial<CmsAdminAdapter> {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      client: new CmsAdminClient({ apiBase: `/api/b2b/b2b/portals/${slug}` }),
      t: (key: string, params?: Record<string, string>) => {
        if (key.startsWith(B2C_FORMS_PREFIX)) {
          const b2bKey = `${B2B_FORMS_PREFIX}${key.slice(B2C_FORMS_PREFIX.length)}`;
          const translated = t(b2bKey, params);
          if (translated !== b2bKey) return translated;
        }
        return t(key, params);
      },
    }),
    [slug, t]
  );
}
