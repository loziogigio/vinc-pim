import { describe, it, expect } from "vitest";
import { APP_IDS, isAppId } from "@/config/app-ids";

describe("app-ids", () => {
  it("includes the apps the catalog references", () => {
    for (const id of ["pim", "store-orders", "store-customers", "team"]) {
      expect(APP_IDS).toContain(id);
    }
  });

  it("has no duplicate ids", () => {
    expect(new Set(APP_IDS).size).toBe(APP_IDS.length);
  });

  it("isAppId narrows correctly", () => {
    expect(isAppId("pim")).toBe(true);
    expect(isAppId("not-an-app")).toBe(false);
  });
});
