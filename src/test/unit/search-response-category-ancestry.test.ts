import { describe, expect, it } from "vitest";
import { transformDocument } from "@/lib/search/response-transformer";

describe("search response category ancestry", () => {
  it("exposes merged category ancestors and localized slug paths to storefronts", () => {
    const product = transformDocument(
      {
        id: "P1",
        entity_code: "P1",
        sku: "SKU-1",
        name_text_it: "Prodotto",
        slug_text_it: "prodotto",
        category_ancestors: ["root", "branch", "leaf"],
        category_slug_path_it: [
          "catalogo",
          "catalogo/utensili",
          "catalogo/utensili/trapani",
        ],
      } as any,
      "it",
    );

    expect(product.category_ancestors).toEqual(["root", "branch", "leaf"]);
    expect(product.category_slug_path).toEqual([
      "catalogo",
      "catalogo/utensili",
      "catalogo/utensili/trapani",
    ]);
  });
});
