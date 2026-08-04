import { describe, it, expect } from "vitest";
import {
  resolveImportStatus,
  requiresStatusWrite,
  PIM_PRODUCT_STATUSES,
} from "@/lib/pim/import-status";

const ELIGIBLE = { autoPublishEligible: true, autoPublishReason: "all required fields present" };
const NOT_ELIGIBLE = { autoPublishEligible: false, autoPublishReason: "Missing required fields: name" };

describe("resolveImportStatus", () => {
  it("uses auto-publish when the payload states no status", () => {
    expect(resolveImportStatus(ELIGIBLE)).toMatchObject({
      status: "published",
      isPublished: true,
      explicit: false,
      autoPublished: true,
    });
    expect(resolveImportStatus(NOT_ELIGIBLE)).toMatchObject({
      status: "draft",
      isPublished: false,
      explicit: false,
      autoPublished: false,
    });
  });

  it("lets an explicit draft win over an eligible auto-publish (the archive case)", () => {
    const resolved = resolveImportStatus({ ...ELIGIBLE, requestedStatus: "draft" });

    expect(resolved.status).toBe("draft");
    expect(resolved.isPublished).toBe(false);
    expect(resolved.explicit).toBe(true);
    expect(resolved.autoPublished).toBe(false);
    expect(resolved.reason).toContain("draft");
  });

  it("lets an explicit publish win when auto-publish is not eligible", () => {
    const resolved = resolveImportStatus({ ...NOT_ELIGIBLE, requestedStatus: "published" });

    expect(resolved.status).toBe("published");
    expect(resolved.isPublished).toBe(true);
    expect(resolved.explicit).toBe(true);
    expect(resolved.autoPublished).toBe(false);
  });

  it("accepts every status the PIM schema allows", () => {
    for (const status of PIM_PRODUCT_STATUSES) {
      expect(resolveImportStatus({ ...ELIGIBLE, requestedStatus: status })).toMatchObject({
        status,
        explicit: true,
      });
    }
  });

  it("keeps auto-publish (and reports the value) when the stated status is not valid", () => {
    const resolved = resolveImportStatus({ ...ELIGIBLE, requestedStatus: "Draft " });

    expect(resolved.status).toBe("published");
    expect(resolved.explicit).toBe(false);
    expect(resolved.ignoredStatus).toBe("Draft ");
  });

  it("ignores non-string statuses without throwing", () => {
    for (const requestedStatus of [null, undefined, 0, 1, {}, [], true]) {
      const resolved = resolveImportStatus({ ...NOT_ELIGIBLE, requestedStatus });
      expect(resolved.status).toBe("draft");
      expect(resolved.explicit).toBe(false);
    }
    expect(resolveImportStatus({ ...NOT_ELIGIBLE, requestedStatus: null }).ignoredStatus).toBeUndefined();
  });

  it("reports the auto-publish reason verbatim when it decides", () => {
    expect(resolveImportStatus(NOT_ELIGIBLE).reason).toBe(NOT_ELIGIBLE.autoPublishReason);
  });
});

describe("requiresStatusWrite", () => {
  it("forces a write when an explicit status differs from the stored one", () => {
    const resolved = resolveImportStatus({ ...ELIGIBLE, requestedStatus: "draft" });
    expect(requiresStatusWrite(resolved, "published")).toBe(true);
  });

  it("does not force a write when the explicit status already matches", () => {
    const resolved = resolveImportStatus({ ...ELIGIBLE, requestedStatus: "draft" });
    expect(requiresStatusWrite(resolved, "draft")).toBe(false);
  });

  it("never forces a write from auto-publish alone", () => {
    // Guard against mass re-publishing manually archived products on a re-sync
    // whose content is unchanged.
    expect(requiresStatusWrite(resolveImportStatus(ELIGIBLE), "archived")).toBe(false);
    expect(requiresStatusWrite(resolveImportStatus(ELIGIBLE), "draft")).toBe(false);
  });

  it("forces a write for an explicit status on a product with no stored status", () => {
    const resolved = resolveImportStatus({ ...ELIGIBLE, requestedStatus: "draft" });
    expect(requiresStatusWrite(resolved, undefined)).toBe(true);
  });
});
