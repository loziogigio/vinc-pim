import { describe, it, expect } from "vitest";
import { parseVisibilityBody } from "@/app/api/b2b/pim/products/[entity_code]/media/visibility/route";

describe("unit: media visibility body parser", () => {
  it("accepts cdn_key + boolean is_public", () => {
    expect(parseVisibilityBody({ cdn_key: "k1", is_public: false })).toEqual({
      mediaIdentifier: "k1", is_public: false,
    });
  });
  it("accepts media_id over cdn_key", () => {
    expect(parseVisibilityBody({ media_id: "m1", cdn_key: "k1", is_public: true })).toEqual({
      mediaIdentifier: "m1", is_public: true,
    });
  });
  it("rejects missing identifier", () => {
    expect(parseVisibilityBody({ is_public: true })).toBeNull();
  });
  it("rejects non-boolean is_public", () => {
    expect(parseVisibilityBody({ cdn_key: "k1", is_public: "yes" })).toBeNull();
  });
});
