import { describe, it, expect } from "vitest";
import { resolveElementIsPublic } from "@/components/pim/dynamic-blocks/ElementRow";

describe("unit: resolveElementIsPublic", () => {
  it("missing → public", () => {
    expect(resolveElementIsPublic({ id: "e", kind: "text", text: "x" } as any)).toBe(true);
  });
  it("true → true", () => {
    expect(resolveElementIsPublic({ id: "e", kind: "text", text: "x", is_public: true } as any)).toBe(true);
  });
  it("false → false", () => {
    expect(resolveElementIsPublic({ id: "e", kind: "text", text: "x", is_public: false } as any)).toBe(false);
  });
});
