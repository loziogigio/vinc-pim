import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  portalUser: null as any,
  findOne: vi.fn(),
}));

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    PortalUser: {
      findOne: (...args: any[]) => ({
        lean: async () => mocks.findOne(...args),
      }),
    },
  })),
}));

import { resolveLivePortalAccess } from "@/lib/sso/live-portal-access";

const profile = {
  id: "user-1",
  email: "user@example.com",
  role: "reseller",
  customers: [
    {
      id: "customer-1",
      erp_customer_id: "C1",
      addresses: [
        { id: "address-1", erp_address_id: "A1" },
        { id: "address-2", erp_address_id: "A2" },
      ],
    },
    {
      id: "customer-2",
      erp_customer_id: "C2",
      addresses: [{ id: "address-3", erp_address_id: "A3" }],
    },
  ],
  has_password: true,
};

beforeEach(() => {
  mocks.portalUser = {
    customer_access: [
      { customer_id: "customer-1", address_access: ["address-1"] },
    ],
  };
  mocks.findOne.mockReset();
  mocks.findOne.mockImplementation(() => mocks.portalUser);
});

describe("resolveLivePortalAccess", () => {
  it("intersects a stale session profile with current customer/address access", async () => {
    const result = await resolveLivePortalAccess(
      "vinc-acme",
      "acme",
      "user-1",
      profile,
    );

    expect(result?.profile?.customers).toEqual([
      {
        id: "customer-1",
        erp_customer_id: "C1",
        addresses: [{ id: "address-1", erp_address_id: "A1" }],
      },
    ]);
    expect(mocks.findOne).toHaveBeenCalledWith(
      {
        portal_user_id: "user-1",
        tenant_id: "acme",
        is_active: true,
      },
      { customer_access: 1 },
    );
  });

  it("preserves all profile addresses for live all-address access", async () => {
    mocks.portalUser.customer_access[0].address_access = "all";

    const result = await resolveLivePortalAccess(
      "vinc-acme",
      "acme",
      "user-1",
      profile,
    );

    expect(result?.profile?.customers[0].addresses).toHaveLength(2);
  });

  it("returns null for a deactivated or deleted portal user", async () => {
    mocks.portalUser = null;

    await expect(
      resolveLivePortalAccess("vinc-acme", "acme", "user-1", profile),
    ).resolves.toBeNull();
  });

  it("keeps an active legacy session without a stored profile customerless", async () => {
    await expect(
      resolveLivePortalAccess("vinc-acme", "acme", "user-1"),
    ).resolves.toEqual({});
  });
});
