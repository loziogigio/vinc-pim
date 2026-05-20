// src/test/unit/blog-constants.test.ts
import { describe, it, expect } from "vitest";
import { BLOG_POST_STATUSES, blogSlugify, BLOG_SLUG_REGEX } from "@/lib/constants/blog";

describe("unit: blog constants", () => {
  it("exposes draft/scheduled/published statuses", () => {
    expect(BLOG_POST_STATUSES).toEqual(["draft", "scheduled", "published"]);
  });

  it("slugifies to lowercase hyphenated text", () => {
    expect(blogSlugify("Hello, World!")).toBe("hello-world");
    expect(blogSlugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
  });

  it("strips accents", () => {
    expect(blogSlugify("Però Càffè")).toBe("pero-caffe");
  });

  it("produced slugs match BLOG_SLUG_REGEX", () => {
    expect(BLOG_SLUG_REGEX.test(blogSlugify("My First Post 2026!"))).toBe(true);
  });
});
