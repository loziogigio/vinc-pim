// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHomeSettingsMock } = vi.hoisted(() => ({
  getHomeSettingsMock: vi.fn(),
}));

vi.mock("@/lib/db/home-settings", () => ({
  getHomeSettings: getHomeSettingsMock,
}));

const { clearCdnConfigCache, getCdnConfig } = await import(
  "@/lib/services/cdn-config"
);

describe("tenant-scoped CDN configuration cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCdnConfigCache();
    getHomeSettingsMock.mockImplementation(async (tenantDb: string) => ({
      cdn_credentials: {
        cdn_url: `https://${tenantDb}.cdn.example.com`,
        bucket_region: "eu-1",
        bucket_name: `${tenantDb}-assets`,
        cdn_key: `${tenantDb}-key`,
        cdn_secret: `${tenantDb}-secret`,
        folder_name: "uploads",
      },
    }));
  });

  it("does not share cached credentials between tenant databases", async () => {
    const tenantA = await getCdnConfig("vinc-a");
    const tenantB = await getCdnConfig("vinc-b");
    const tenantAFromCache = await getCdnConfig("vinc-a");

    expect(tenantA?.endpoint).toBe("https://vinc-a.cdn.example.com");
    expect(tenantB?.endpoint).toBe("https://vinc-b.cdn.example.com");
    expect(tenantAFromCache).toBe(tenantA);
    expect(getHomeSettingsMock).toHaveBeenCalledTimes(2);
    expect(getHomeSettingsMock).toHaveBeenNthCalledWith(1, "vinc-a");
    expect(getHomeSettingsMock).toHaveBeenNthCalledWith(2, "vinc-b");
  });

  it("can invalidate one tenant without evicting the others", async () => {
    const tenantA = await getCdnConfig("vinc-a");
    const tenantB = await getCdnConfig("vinc-b");

    clearCdnConfigCache("vinc-a");

    expect(await getCdnConfig("vinc-a")).not.toBe(tenantA);
    expect(await getCdnConfig("vinc-b")).toBe(tenantB);
    expect(getHomeSettingsMock).toHaveBeenCalledTimes(3);
  });
});
