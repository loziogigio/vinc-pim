import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tenant: Record<string, any> = {
    features: { is_demo: true },
    api: {
      pim_api_url: "https://suite.example",
      api_key_id: "key-id",
      api_secret: "secret",
      erp_url: "https://erp.example",
    },
    save: vi.fn(async () => undefined),
    set: vi.fn(),
  };

  return {
    tenant,
    findByTenantId: vi.fn(async () => tenant),
    notifyTenantCacheClear: vi.fn(async () => undefined),
    regenerateB2CConfigDebounced: vi.fn(),
  };
});

vi.mock("@/lib/db/models/admin-tenant", () => ({
  getTenantModel: vi.fn(async () => ({
    findByTenantId: mocks.findByTenantId,
  })),
}));

vi.mock("@/lib/services/cache-clear.service", () => ({
  notifyTenantCacheClear: mocks.notifyTenantCacheClear,
}));

vi.mock("@/lib/services/traefik-config.service", () => ({
  regenerateB2BConfig: vi.fn(async () => undefined),
  regenerateB2CConfigDebounced: mocks.regenerateB2CConfigDebounced,
}));

import { updateTenant } from "@/lib/services/admin-tenant.service";

describe("updateTenant storefront feature merge", () => {
  beforeEach(() => {
    mocks.tenant.features = { is_demo: true };
    mocks.tenant.api = {
      pim_api_url: "https://suite.example",
      api_key_id: "key-id",
      api_secret: "secret",
      erp_url: "https://erp.example",
    };
    mocks.tenant.save.mockClear();
    mocks.tenant.set.mockReset();
    mocks.tenant.set.mockImplementation((path: string, value: unknown) => {
      const [root, key] = path.split(".");
      mocks.tenant[root] ??= {};
      mocks.tenant[root][key] = value;
    });
    mocks.findByTenantId.mockClear();
    mocks.notifyTenantCacheClear.mockClear();
    mocks.regenerateB2CConfigDebounced.mockClear();
  });

  it("changes pricing_source without replacing unrelated feature flags", async () => {
    await updateTenant("acme", {
      features: { pricing_source: "erp" },
    });

    expect(mocks.tenant.set).toHaveBeenCalledWith(
      "features.pricing_source",
      "erp",
    );
    expect(mocks.tenant.features).toEqual({
      is_demo: true,
      pricing_source: "erp",
    });
    expect(mocks.tenant.save).toHaveBeenCalledOnce();
    expect(mocks.notifyTenantCacheClear).toHaveBeenCalledWith({
      tenantId: "acme",
    });
  });

  it("saves combined status and storefront changes with one cache notification", async () => {
    await updateTenant("acme", {
      status: "suspended",
      features: { pricing_source: "erp" },
    });

    expect(mocks.tenant.status).toBe("suspended");
    expect(mocks.tenant.features).toEqual({
      is_demo: true,
      pricing_source: "erp",
    });
    expect(mocks.tenant.save).toHaveBeenCalledOnce();
    expect(mocks.notifyTenantCacheClear).toHaveBeenCalledOnce();
    expect(mocks.regenerateB2CConfigDebounced).toHaveBeenCalledOnce();
  });

  it("merges a partial ERP URL update without erasing API credentials", async () => {
    await updateTenant("acme", {
      api: { erp_url: "" },
    });

    expect(mocks.tenant.api).toEqual({
      pim_api_url: "https://suite.example",
      api_key_id: "key-id",
      api_secret: "secret",
      erp_url: "",
    });
    expect(mocks.tenant.set).toHaveBeenCalledWith("api.erp_url", "");
    expect(mocks.tenant.set).not.toHaveBeenCalledWith(
      "api.api_secret",
      undefined,
    );
  });
});
