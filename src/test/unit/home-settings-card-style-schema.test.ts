/**
 * Regression test for the "Product cards: nothing changes on save" bug.
 *
 * `priceDecimals` lives in the ProductCardStyle TS type, the UI control and
 * DEFAULT_CARD_STYLE, but was missing from the Mongoose ProductCardStyleSchema.
 * Mongoose strict mode silently strips unknown paths, so the value never
 * persisted: the user saved (HTTP 200, no error), reloaded, and it reverted.
 *
 * Constructing a Mongoose document applies the schema (and its strict-mode
 * stripping) WITHOUT a DB connection, so this is a pure unit test.
 */

import { describe, it, expect } from "vitest";
import { B2BHomeSettingsModel } from "@/lib/db/models/home-settings";

describe("unit: Home Settings - ProductCardStyle schema persistence", () => {
  it("retains priceDecimals on the cardStyle subdocument", () => {
    const doc = new B2BHomeSettingsModel({
      customerId: "test-card-style",
      branding: { title: "Test" },
      cardStyle: {
        borderWidth: 2,
        borderColor: "#123456",
        priceDecimals: 0,
      },
    });

    // Sanity: a known-good field is retained.
    expect(doc.cardStyle?.borderColor).toBe("#123456");
    // The bug: priceDecimals was stripped (undefined) before the schema fix.
    expect(doc.cardStyle?.priceDecimals).toBe(0);
  });
});
