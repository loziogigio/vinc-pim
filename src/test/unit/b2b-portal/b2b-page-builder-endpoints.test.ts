/**
 * Regression guard: the new B2B page builder
 * (src/app/b2b/(builder)/b2b-page-builder/page.tsx) must talk to the
 * Phase-3 portal-scoped page-template endpoints, not the B2C
 * /api/b2b/b2c/storefronts/* routes, the legacy /api/home-template/* routes,
 * or the legacy /api/pages routes.
 *
 * The page is a Suspense-wrapped, hook-heavy client component, so instead of
 * rendering it we test the URL-builder it uses
 * (src/app/b2b/(builder)/b2b-page-builder/api.ts) — a standalone module with
 * no React/Next imports. Mirrors b2b-home-builder-endpoints.test.ts.
 */

import { describe, it, expect } from "vitest";
import {
  b2bPageTemplateApi,
  b2bPortalDoc,
  DEFAULT_PORTAL_SLUG,
} from "@/app/b2b/(builder)/b2b-page-builder/api";

describe("b2b-page-builder API endpoints", () => {
  it("defaults the portal slug to 'default'", () => {
    expect(DEFAULT_PORTAL_SLUG).toBe("default");
  });

  it("scopes the page-template GET under /api/b2b/b2b/portals/<slug>/pages/<pageSlug>/template", () => {
    expect(b2bPageTemplateApi("default", "about").get).toBe(
      "/api/b2b/b2b/portals/default/pages/about/template"
    );
  });

  it("builds the save-draft endpoint under the template path", () => {
    expect(b2bPageTemplateApi("default", "about").saveDraft).toBe(
      "/api/b2b/b2b/portals/default/pages/about/template/save-draft"
    );
  });

  it("builds the publish endpoint under the template path", () => {
    expect(b2bPageTemplateApi("default", "about").publish).toBe(
      "/api/b2b/b2b/portals/default/pages/about/template/publish"
    );
  });

  it("uses GET /api/b2b/b2b/portals/<slug> for the live-preview branding/domain", () => {
    expect(b2bPortalDoc("default")).toBe("/api/b2b/b2b/portals/default");
  });

  it("interpolates the portal slug and page slug correctly for other combos", () => {
    const api = b2bPageTemplateApi("acme", "contact-us");
    const prefix = "/api/b2b/b2b/portals/acme/pages/contact-us/template";
    expect(api.get).toBe(prefix);
    expect(api.saveDraft).toBe(`${prefix}/save-draft`);
    expect(api.publish).toBe(`${prefix}/publish`);
    expect(b2bPortalDoc("acme")).toBe("/api/b2b/b2b/portals/acme");
  });

  it("never references the B2C, legacy home-template, or legacy /api/pages paths", () => {
    const allUrls = [
      ...Object.values(b2bPageTemplateApi("default", "about")),
      ...Object.values(b2bPageTemplateApi("acme", "contact-us")),
      b2bPortalDoc("default"),
      b2bPortalDoc("acme"),
    ];
    for (const url of allUrls) {
      expect(url).not.toMatch(/\/api\/b2b\/b2c\//);
      expect(url).not.toMatch(/\/api\/home-template/);
      expect(url).not.toMatch(/\/api\/pages\b/);
    }
  });
});
