import { describe, it, expect } from "vitest";
import type { IB2BPortal } from "@/lib/types/b2b-portal";
import { B2B_PORTAL_STATUSES, DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

describe("b2b-portal types", () => {
  it("DEFAULT_PORTAL_SLUG is 'default'", () => {
    expect(DEFAULT_PORTAL_SLUG).toBe("default");
  });

  it("B2B_PORTAL_STATUSES contains active and inactive", () => {
    expect(B2B_PORTAL_STATUSES).toEqual(["active", "inactive"]);
  });

  it("IB2BPortal type has required fields", () => {
    const portal: IB2BPortal = {
      slug: "default",
      name: "Main B2B",
      channel: "default",
      domains: [],
      status: "active",
      branding: {},
      header_config: { rows: [] },
      footer: {},
      meta_tags: {},
      custom_scripts: [],
      settings: {},
      created_at: new Date(),
      updated_at: new Date(),
    };
    expect(portal.slug).toBe("default");
  });
});
