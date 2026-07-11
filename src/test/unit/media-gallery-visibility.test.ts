import { describe, it, expect } from "vitest";
import { resolveMediaIsPublic } from "@/components/pim/MediaGallery";

describe("unit: resolveMediaIsPublic", () => {
  it("missing flag → public (true)", () => {
    expect(resolveMediaIsPublic({} as any)).toBe(true);
  });
  it("is_public:true → true", () => {
    expect(resolveMediaIsPublic({ is_public: true } as any)).toBe(true);
  });
  it("is_public:false → false", () => {
    expect(resolveMediaIsPublic({ is_public: false } as any)).toBe(false);
  });
});
