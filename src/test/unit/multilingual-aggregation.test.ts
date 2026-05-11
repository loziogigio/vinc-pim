/**
 * Unit tests for distinctMultilingualValues.
 *
 * Regression coverage for the PIM filters endpoint crash:
 *   "$objectToArray requires a document input, found: string"
 * Some documents store a `MultilingualText` field (Mixed type) as a plain
 * string or empty string instead of a `{ lang: value }` map — those rows must
 * be skipped, not blow up the aggregation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose, { Schema } from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { distinctMultilingualValues } from "@/lib/db/multilingual-aggregation";

const ProductLikeSchema = new Schema({
  isCurrent: Boolean,
  product_type: {
    name: Schema.Types.Mixed, // MultilingualText is persisted as Mixed
  },
});

const ProductLike =
  (mongoose.models.MlAggProductLike as mongoose.Model<unknown>) ||
  mongoose.model("MlAggProductLike", ProductLikeSchema);

describe("unit: distinctMultilingualValues", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it("collects distinct values across languages and ignores legacy / empty / missing values", async () => {
    await ProductLike.create([
      { isCurrent: true, product_type: { name: { it: "Cavi", en: "Cables" } } },
      { isCurrent: true, product_type: { name: { it: "Viti", en: "Screws" } } },
      { isCurrent: true, product_type: { name: { it: "Cavi" } } }, // duplicate "Cavi"
      { isCurrent: true, product_type: { name: "Legacy plain string" } }, // would crash $objectToArray
      { isCurrent: true, product_type: { name: "" } }, // empty string
      { isCurrent: true, product_type: {} }, // missing name
      { isCurrent: false, product_type: { name: { it: "Nascosto", en: "Hidden" } } }, // excluded by base match
    ]);

    const values = await distinctMultilingualValues(ProductLike, "product_type.name", { isCurrent: true });

    // $sort: { _id: 1 } → byte-order sort: "Cables" < "Cavi" < "Screws" < "Viti"
    expect(values).toEqual(["Cables", "Cavi", "Screws", "Viti"]);
  });

  it("does not throw when every document stores the field as a string", async () => {
    await ProductLike.create([
      { isCurrent: true, product_type: { name: "Just a string" } },
      { isCurrent: true, product_type: { name: "" } },
    ]);

    const values = await distinctMultilingualValues(ProductLike, "product_type.name", { isCurrent: true });

    expect(values).toEqual([]);
  });

  it("applies a case-insensitive substring search across languages", async () => {
    await ProductLike.create([
      { isCurrent: true, product_type: { name: { it: "Cavi elettrici", en: "Electric cables" } } },
      { isCurrent: true, product_type: { name: { it: "Viti", en: "Screws" } } },
    ]);

    // "EL" matches both "Cavi elettrici" and "Electric cables", neither "Viti"/"Screws".
    const values = await distinctMultilingualValues(ProductLike, "product_type.name", { isCurrent: true }, "EL");

    expect(values).toEqual(["Cavi elettrici", "Electric cables"]);
  });

  it("respects the limit argument", async () => {
    await ProductLike.create([
      { isCurrent: true, product_type: { name: { en: "Alpha" } } },
      { isCurrent: true, product_type: { name: { en: "Bravo" } } },
      { isCurrent: true, product_type: { name: { en: "Charlie" } } },
    ]);

    const values = await distinctMultilingualValues(ProductLike, "product_type.name", { isCurrent: true }, "", 2);

    expect(values).toEqual(["Alpha", "Bravo"]);
  });
});
