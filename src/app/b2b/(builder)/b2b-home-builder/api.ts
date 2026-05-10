/**
 * URL builders for the B2B home-builder's Phase-1 API calls.
 *
 * Kept in a standalone module (no React / Next imports) so the endpoint
 * regression test can import it without rendering the page component.
 *
 * All endpoints are scoped to a portal slug:
 *   /api/b2b/b2b/portals/[slug]/home-template/*
 * plus the portal document itself (for the live-preview branding/domain):
 *   /api/b2b/b2b/portals/[slug]
 */

/** Default portal slug used when the `?portal=` query param is absent. */
export const DEFAULT_PORTAL_SLUG = "default";

export interface B2BHomeTemplateApi {
  /** GET base — `/api/b2b/b2b/portals/<slug>/home-template` */
  base: string;
  /** GET base, optionally with `?v=<version>` */
  get: (version?: number | string | null) => string;
  saveDraft: string;
  publish: string;
  publishVersion: string;
  startNewVersion: string;
  loadVersion: string;
  deleteVersion: string;
  duplicateVersion: string;
  unpublishVersion: string;
  updateVersion: string;
  /** GET the portal document (branding / domains) */
  portal: string;
}

/** Builds the set of Phase-1 home-template API endpoints for a portal. */
export function b2bHomeTemplateApi(portalSlug: string): B2BHomeTemplateApi {
  const base = `/api/b2b/b2b/portals/${portalSlug}/home-template`;
  return {
    base,
    get: (version) =>
      version != null && version !== "" ? `${base}?v=${version}` : base,
    saveDraft: `${base}/save-draft`,
    publish: `${base}/publish`,
    publishVersion: `${base}/publish-version`,
    startNewVersion: `${base}/start-new-version`,
    loadVersion: `${base}/load-version`,
    deleteVersion: `${base}/delete-version`,
    duplicateVersion: `${base}/duplicate-version`,
    unpublishVersion: `${base}/unpublish-version`,
    updateVersion: `${base}/update-version`,
    portal: `/api/b2b/b2b/portals/${portalSlug}`,
  };
}
