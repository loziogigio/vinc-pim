/**
 * Regression guard: the new B2B home builder
 * (src/app/b2b/(builder)/b2b-home-builder/page.tsx) must talk to the
 * Phase-1 portal-scoped home-template endpoints, not the legacy
 * /api/home-template/* or /api/b2b/home-settings routes.
 *
 * The page is a Suspense-wrapped, hook-heavy client component, so instead
 * of rendering it we test the URL-builder it uses
 * (src/app/b2b/(builder)/b2b-home-builder/api.ts) — a standalone module
 * with no React/Next imports. See Task 4, Step 3 (option a).
 */

import { describe, it, expect } from "vitest";
import {
  b2bHomeTemplateApi,
  DEFAULT_PORTAL_SLUG,
} from "@/app/b2b/(builder)/b2b-home-builder/api";

describe("b2b-home-builder API endpoints", () => {
  it("defaults the portal slug to 'default'", () => {
    expect(DEFAULT_PORTAL_SLUG).toBe("default");
  });

  it("scopes every endpoint under /api/b2b/b2b/portals/<slug>/home-template", () => {
    const api = b2bHomeTemplateApi("acme");
    const prefix = "/api/b2b/b2b/portals/acme/home-template";

    expect(api.base).toBe(prefix);
    expect(api.get()).toBe(prefix);
    expect(api.saveDraft).toBe(`${prefix}/save-draft`);
    expect(api.publish).toBe(`${prefix}/publish`);
    expect(api.publishVersion).toBe(`${prefix}/publish-version`);
    expect(api.startNewVersion).toBe(`${prefix}/start-new-version`);
    expect(api.loadVersion).toBe(`${prefix}/load-version`);
    expect(api.deleteVersion).toBe(`${prefix}/delete-version`);
    expect(api.duplicateVersion).toBe(`${prefix}/duplicate-version`);
    expect(api.unpublishVersion).toBe(`${prefix}/unpublish-version`);
    expect(api.updateVersion).toBe(`${prefix}/update-version`);
  });

  it("appends the ?v= version param to the GET url when given", () => {
    const api = b2bHomeTemplateApi("default");
    expect(api.get(3)).toBe(
      "/api/b2b/b2b/portals/default/home-template?v=3"
    );
    expect(api.get("7")).toBe(
      "/api/b2b/b2b/portals/default/home-template?v=7"
    );
    // null / empty -> no query param
    expect(api.get(null)).toBe("/api/b2b/b2b/portals/default/home-template");
    expect(api.get("")).toBe("/api/b2b/b2b/portals/default/home-template");
  });

  it("uses GET /api/b2b/b2b/portals/<slug> for the live-preview branding/domain (not /api/b2b/home-settings)", () => {
    const api = b2bHomeTemplateApi("acme");
    expect(api.portal).toBe("/api/b2b/b2b/portals/acme");
  });

  it("never references the legacy /api/home-template or /api/b2b/home-settings paths", () => {
    const api = b2bHomeTemplateApi("default");
    const allUrls = [
      api.base,
      api.get(),
      api.get(2),
      api.saveDraft,
      api.publish,
      api.publishVersion,
      api.startNewVersion,
      api.loadVersion,
      api.deleteVersion,
      api.duplicateVersion,
      api.unpublishVersion,
      api.updateVersion,
      api.portal,
    ];
    for (const url of allUrls) {
      expect(url).not.toMatch(/\/api\/home-template/);
      expect(url).not.toMatch(/\/api\/b2b\/home-settings/);
    }
  });
});
