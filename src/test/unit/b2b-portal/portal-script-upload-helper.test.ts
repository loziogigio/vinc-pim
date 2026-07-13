import { describe, expect, it } from "vitest";
import type { CdnConfig } from "vinc-cdn";
import {
  MAX_PORTAL_SCRIPT_SIZE_BYTES,
  buildPortalScriptFolder,
  hasSecureCdnEndpoint,
  isHttpsAssetUrl,
  validatePortalScriptFile,
} from "@/lib/uploads/portal-script-upload";

describe("portal script upload validation", () => {
  it.each([
    ["analytics.js", "text/javascript"],
    ["ANALYTICS.JS", "application/ecmascript; charset=utf-8"],
  ])("accepts %s with JavaScript MIME %s", (name, type) => {
    expect(validatePortalScriptFile({ name, type, size: 10 })).toEqual({
      valid: true,
      contentType: "text/javascript",
    });
  });

  it("requires both an allowed extension and JavaScript MIME", () => {
    expect(
      validatePortalScriptFile({
        name: "analytics.txt",
        type: "text/javascript",
        size: 10,
      }),
    ).toEqual({ valid: false, error: "Only .js files are allowed" });

    expect(
      validatePortalScriptFile({
        name: "analytics.mjs",
        type: "text/javascript",
        size: 10,
      }),
    ).toEqual({ valid: false, error: "Only .js files are allowed" });

    expect(
      validatePortalScriptFile({
        name: "analytics.js",
        type: "text/plain",
        size: 10,
      }),
    ).toEqual({ valid: false, error: "File MIME type must be JavaScript" });
  });

  it("rejects empty and oversized assets", () => {
    expect(
      validatePortalScriptFile({
        name: "empty.js",
        type: "text/javascript",
        size: 0,
      }),
    ).toEqual({ valid: false, error: "JavaScript file is empty" });

    expect(
      validatePortalScriptFile({
        name: "large.js",
        type: "text/javascript",
        size: MAX_PORTAL_SCRIPT_SIZE_BYTES + 1,
      }),
    ).toMatchObject({ valid: false });
  });
});

describe("portal script CDN scope", () => {
  const config = (endpoint: string): CdnConfig => ({
    endpoint,
    region: "eu-1",
    bucket: "assets",
    accessKeyId: "key",
    secretAccessKey: "secret",
  });

  it("builds a tenant and portal scoped folder", () => {
    expect(
      buildPortalScriptFolder("uploads/", "ACME/../Other", "Main Portal"),
    ).toBe("uploads/b2b/acme-other/portals/main-portal/scripts");
  });

  it("accepts only secure CDN endpoints and asset URLs", () => {
    expect(hasSecureCdnEndpoint(config("cdn.example.com"))).toBe(true);
    expect(hasSecureCdnEndpoint(config("https://cdn.example.com"))).toBe(true);
    expect(hasSecureCdnEndpoint(config("http://cdn.example.com"))).toBe(false);
    expect(isHttpsAssetUrl("https://cdn.example.com/script.js")).toBe(true);
    expect(isHttpsAssetUrl("http://cdn.example.com/script.js")).toBe(false);
  });
});
