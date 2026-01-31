import { describe, it, expect } from "vitest";
import { parseSearchUrl, buildFiltersObject } from "@/components/notifications/SearchUrlInput";

describe("unit: SearchUrlInput parseSearchUrl", () => {
  describe("basic URL parsing", () => {
    it("should parse simple search URL with keyword", () => {
      const result = parseSearchUrl("shop?text=caldaia");
      expect(result).not.toBeNull();
      expect(result?.basePath).toBe("shop");
      expect(result?.keyword).toBe("caldaia");
      expect(result?.filters).toHaveLength(0);
      expect(result?.queryString).toBe("text=caldaia");
    });

    it("should parse search URL with filters", () => {
      const result = parseSearchUrl("shop?text=prodotto&filters-brand_id=004");
      expect(result).not.toBeNull();
      expect(result?.keyword).toBe("prodotto");
      expect(result?.filters).toHaveLength(1);
      expect(result?.filters[0].key).toBe("brand_id");
      expect(result?.filters[0].values).toEqual(["004"]);
    });

    it("should parse multiple filter values separated by semicolon", () => {
      const result = parseSearchUrl("shop?filters-brand_id=004;005;006");
      expect(result).not.toBeNull();
      expect(result?.filters[0].values).toEqual(["004", "005", "006"]);
    });

    it("should parse multiple different filters", () => {
      const result = parseSearchUrl("shop?text=vaso&filters-brand_id=004&filters-category_id=001");
      expect(result).not.toBeNull();
      expect(result?.filters).toHaveLength(2);
      expect(result?.filters.find((f) => f.key === "brand_id")).toBeDefined();
      expect(result?.filters.find((f) => f.key === "category_id")).toBeDefined();
    });
  });

  describe("different base paths", () => {
    it("should handle /shop path", () => {
      const result = parseSearchUrl("/shop?text=test");
      expect(result?.basePath).toBe("/shop");
    });

    it("should handle /search path", () => {
      const result = parseSearchUrl("/search?text=test");
      expect(result?.basePath).toBe("/search");
    });

    it("should handle search without leading slash", () => {
      const result = parseSearchUrl("search?text=test");
      expect(result?.basePath).toBe("search");
    });
  });

  describe("filter label resolution", () => {
    it("should provide label for known filters", () => {
      const result = parseSearchUrl("shop?filters-brand_id=004");
      expect(result?.filters[0].label).toBe("Marca");
    });

    it("should provide label for stock_status", () => {
      const result = parseSearchUrl("shop?filters-stock_status=in_stock");
      expect(result?.filters[0].label).toBe("Disponibilità");
    });

    it("should use key as label for unknown filters", () => {
      const result = parseSearchUrl("shop?filters-custom_field=value");
      expect(result?.filters[0].label).toBe("custom_field");
    });
  });

  describe("edge cases", () => {
    it("should return null for empty string", () => {
      expect(parseSearchUrl("")).toBeNull();
    });

    it("should return null for plain text without query params", () => {
      expect(parseSearchUrl("just some text")).toBeNull();
    });

    it("should handle URL with only filters (no keyword)", () => {
      const result = parseSearchUrl("shop?filters-brand_id=004");
      expect(result).not.toBeNull();
      expect(result?.keyword).toBe("");
      expect(result?.filters).toHaveLength(1);
    });

    it("should ignore pagination parameters", () => {
      const result = parseSearchUrl("shop?text=test&limit=20&page=2&start=0");
      expect(result?.filters).toHaveLength(0);
      expect(result?.keyword).toBe("test");
    });

    it("should handle alternative query parameter 'q'", () => {
      const result = parseSearchUrl("shop?q=caldaia");
      expect(result?.keyword).toBe("caldaia");
    });
  });

  describe("buildFiltersObject", () => {
    it("should build filters object from parsed URL", () => {
      const parsed = parseSearchUrl("shop?filters-brand_id=004&filters-stock_status=in_stock");
      expect(parsed).not.toBeNull();
      const filters = buildFiltersObject(parsed!);
      expect(filters).toEqual({
        brand_id: "004",
        stock_status: "in_stock",
      });
    });

    it("should handle multiple values as array", () => {
      const parsed = parseSearchUrl("shop?filters-brand_id=004;005;006");
      expect(parsed).not.toBeNull();
      const filters = buildFiltersObject(parsed!);
      expect(filters.brand_id).toEqual(["004", "005", "006"]);
    });

    it("should map legacy field names to PIM names", () => {
      const parsed = parseSearchUrl("shop?filters-is_new=true&filters-category=001");
      expect(parsed).not.toBeNull();
      const filters = buildFiltersObject(parsed!);
      expect(filters).toHaveProperty("attribute_is_new_b", "true");
      expect(filters).toHaveProperty("category_ancestors", "001");
    });

    it("should return empty object when no filters", () => {
      const parsed = parseSearchUrl("shop?text=caldaia");
      expect(parsed).not.toBeNull();
      const filters = buildFiltersObject(parsed!);
      expect(filters).toEqual({});
    });
  });
});
