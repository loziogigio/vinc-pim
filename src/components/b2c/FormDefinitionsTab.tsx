"use client";

import { useMemo } from "react";
import { CmsAdminClient } from "vinc-cms-admin";
import {
  CmsAdminProvider,
  FormDefinitionsTab as PackageFormDefinitionsTab,
} from "vinc-cms-admin/react";
import { useTranslation } from "@/lib/i18n/useTranslation";

const FORM_DEFINITIONS_SUFFIX = "/form-definitions";

interface FormDefinitionsTabProps {
  storefrontSlug: string;
  /**
   * Base path for the form-definitions COLLECTION (the pre-extraction CS API
   * contract), e.g. `/api/b2b/b2b/portals/${slug}/form-definitions`. Defaults to
   * the B2C storefront's form-definitions collection.
   *
   * The package's `FormDefinitionsTab` is client-backed: it reads a `CmsAdminClient`
   * off the `CmsAdminProvider` context instead of building fetch URLs itself, and that
   * client's `apiBase` is the ROOT resource (it appends `/form-definitions` itself —
   * see `CmsAdminClient#listFormDefinitions` etc). This wrapper exists only to bridge
   * that gap for the two remaining callers that still pass the old collection-URL
   * `apiBase`: it strips a trailing `/form-definitions` segment to recover the root,
   * builds a local client/provider around it, and mounts the package component inside.
   * It cannot be a bare re-export because the package component requires a provider.
   */
  apiBase?: string;
}

export function FormDefinitionsTab({ storefrontSlug, apiBase }: FormDefinitionsTabProps) {
  const { t } = useTranslation();
  const collectionBase =
    apiBase ?? `/api/b2b/b2c/storefronts/${storefrontSlug}${FORM_DEFINITIONS_SUFFIX}`;
  const apiBaseRoot = collectionBase.endsWith(FORM_DEFINITIONS_SUFFIX)
    ? collectionBase.slice(0, -FORM_DEFINITIONS_SUFFIX.length)
    : collectionBase;

  const adapter = useMemo(
    () => ({ client: new CmsAdminClient({ apiBase: apiBaseRoot }), t }),
    [apiBaseRoot, t]
  );

  return (
    <CmsAdminProvider adapter={adapter}>
      <PackageFormDefinitionsTab storefrontSlug={storefrontSlug} />
    </CmsAdminProvider>
  );
}
