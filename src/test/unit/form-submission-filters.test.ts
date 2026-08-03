import { describe, it, expect } from "vitest";
import {
  parseSubmissionFilters,
  buildSubmissionQuery,
} from "@/lib/services/form-submission.service";

describe("parseSubmissionFilters", () => {
  it("reads every supported param from URLSearchParams", () => {
    const params = new URLSearchParams({
      page_slug: "contact",
      form_type: "standalone",
      ip: "10.0.0.1",
      email: "ada@example.com",
      seen: "unseen",
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
    expect(parseSubmissionFilters(params)).toEqual({
      page_slug: "contact",
      form_type: "standalone",
      ip: "10.0.0.1",
      email: "ada@example.com",
      seen: false,
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
  });

  it("reads the same shape from a plain object body", () => {
    expect(parseSubmissionFilters({ seen: "seen", email: "  ada@example.com  " })).toEqual({
      seen: true,
      email: "ada@example.com",
    });
  });

  it("accepts a real boolean for seen", () => {
    expect(parseSubmissionFilters({ seen: true })).toEqual({ seen: true });
    expect(parseSubmissionFilters({ seen: false })).toEqual({ seen: false });
  });

  it("drops empty, blank and unknown values", () => {
    const params = new URLSearchParams({ page_slug: "", ip: "   ", nonsense: "x" });
    expect(parseSubmissionFilters(params)).toEqual({});
  });

  it("ignores an unrecognised form_type and seen value", () => {
    expect(parseSubmissionFilters({ form_type: "bogus", seen: "maybe" })).toEqual({});
  });

  it("ignores malformed dates", () => {
    expect(parseSubmissionFilters({ date_from: "01/02/2026", date_to: "2026-13-45" })).toEqual({});
  });
});

describe("buildSubmissionQuery", () => {
  it("always applies the scope key", () => {
    expect(buildSubmissionQuery("storefront_slug", "demo", {})).toEqual({
      storefront_slug: "demo",
    });
    expect(buildSubmissionQuery("portal_slug", "default", {})).toEqual({
      portal_slug: "default",
    });
  });

  it("matches page_slug, ip and email as case-insensitive substrings", () => {
    const query = buildSubmissionQuery("storefront_slug", "demo", {
      page_slug: "cont",
      ip: "10.0",
      email: "ADA",
    });
    expect(query.page_slug).toEqual({ $regex: "cont", $options: "i" });
    expect(query.ip_address).toEqual({ $regex: "10\\.0", $options: "i" });
    expect(query.submitter_email).toEqual({ $regex: "ADA", $options: "i" });
  });

  it("matches form_type exactly", () => {
    const query = buildSubmissionQuery("portal_slug", "default", { form_type: "page_form" });
    expect(query.form_type).toBe("page_form");
  });

  it("maps seen to a boolean field", () => {
    expect(buildSubmissionQuery("portal_slug", "d", { seen: true }).seen).toBe(true);
    expect(buildSubmissionQuery("portal_slug", "d", { seen: false }).seen).toBe(false);
  });

  it("bounds created_at on UTC day boundaries", () => {
    const query = buildSubmissionQuery("storefront_slug", "demo", {
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
    expect(query.created_at).toEqual({
      $gte: new Date("2026-01-01T00:00:00.000Z"),
      $lte: new Date("2026-01-31T23:59:59.999Z"),
    });
  });

  it("supports an open-ended range on either side", () => {
    expect(
      buildSubmissionQuery("storefront_slug", "demo", { date_from: "2026-01-01" }).created_at
    ).toEqual({ $gte: new Date("2026-01-01T00:00:00.000Z") });
    expect(
      buildSubmissionQuery("storefront_slug", "demo", { date_to: "2026-01-31" }).created_at
    ).toEqual({ $lte: new Date("2026-01-31T23:59:59.999Z") });
  });

  it("omits created_at entirely when no dates are given", () => {
    expect(buildSubmissionQuery("storefront_slug", "demo", {}).created_at).toBeUndefined();
  });
});
