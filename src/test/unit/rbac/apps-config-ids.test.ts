import { describe, it, expect } from "vitest";
import { APPS } from "@/config/apps.config";
import { isAppId } from "@/config/app-ids";

describe("apps.config ↔ app-ids drift guard", () => {
  it("every APPS id is a canonical AppId", () => {
    for (const app of APPS) {
      expect(isAppId(app.id), `apps.config id "${app.id}" missing from APP_IDS`).toBe(true);
    }
  });
});
