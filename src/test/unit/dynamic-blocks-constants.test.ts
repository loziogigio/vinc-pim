import { describe, it, expect } from "vitest";
import {
  DYNAMIC_BLOCKS_MAX_COUNT,
  DYNAMIC_BLOCK_MAX_ELEMENTS,
  DYNAMIC_BLOCK_COLUMNS_MIN,
  DYNAMIC_BLOCK_COLUMNS_MAX,
  DYNAMIC_BLOCK_SECTIONS,
} from "@/lib/constants/dynamic-blocks";

describe("unit: dynamic-blocks constants", () => {
  it("caps blocks at 20 and elements at 24", () => {
    expect(DYNAMIC_BLOCKS_MAX_COUNT).toBe(20);
    expect(DYNAMIC_BLOCK_MAX_ELEMENTS).toBe(24);
  });

  it("bounds columns to 1..8", () => {
    expect(DYNAMIC_BLOCK_COLUMNS_MIN).toBe(1);
    expect(DYNAMIC_BLOCK_COLUMNS_MAX).toBe(8);
  });

  it("enumerates sections 1..4 as a readonly tuple", () => {
    expect(DYNAMIC_BLOCK_SECTIONS).toEqual([1, 2, 3, 4]);
  });
});
