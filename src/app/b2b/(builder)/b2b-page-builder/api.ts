/**
 * URL builders for the B2B page-builder's Phase-3 API calls.
 *
 * Kept in a standalone module (no React / Next imports) so the endpoint
 * regression test can import it without rendering the page component.
 *
 * All endpoints are scoped to a portal slug + a page slug:
 *   /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/*
 * plus the portal document itself (for the live-preview branding/domain):
 *   /api/b2b/b2b/portals/[slug]
 */

import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

/** Default portal slug used when the `?portal=` query param is absent. */
export { DEFAULT_PORTAL_SLUG };

export interface B2BPageTemplateApi {
  /** GET — `/api/b2b/b2b/portals/<slug>/pages/<pageSlug>/template` */
  get: string;
  /** POST `{ blocks, seo }` — saves a draft */
  saveDraft: string;
  /** POST — publishes the page */
  publish: string;
}

/** Builds the set of Phase-3 page-template API endpoints for a portal page. */
export function b2bPageTemplateApi(
  portalSlug: string,
  pageSlug: string
): B2BPageTemplateApi {
  const base = `/api/b2b/b2b/portals/${portalSlug}/pages/${pageSlug}/template`;
  return {
    get: base,
    saveDraft: `${base}/save-draft`,
    publish: `${base}/publish`,
  };
}

/** GET the portal document (branding / domains) for the live-preview iframe. */
export function b2bPortalDoc(portalSlug: string): string {
  return `/api/b2b/b2b/portals/${portalSlug}`;
}
