import { describe, it, expect } from "vitest";
import { intersectWithEntitlement, assembleAuthorization } from "@/lib/auth/permissions/resolve";
import { ALL_SCOPE } from "@/lib/auth/permissions/scope";

describe("intersectWithEntitlement", () => {
  it("keeps only permissions whose app is entitled", () => {
    const result = intersectWithEntitlement(
      ["pim.product.view", "orders.cancel", "customers.view"],
      ["pim", "store-customers"] // store-orders NOT entitled
    );
    expect(result).toContain("pim.product.view");
    expect(result).toContain("customers.view");
    expect(result).not.toContain("orders.cancel");
  });

  it("returns all permissions unchanged when entitledApps is undefined (no filter)", () => {
    const perms = ["pim.product.view", "orders.cancel"] as const;
    expect(intersectWithEntitlement([...perms], undefined)).toEqual([...perms]);
  });
});

describe("assembleAuthorization", () => {
  it("exposes permissions Set, working can(), ability and scope", () => {
    const authz = assembleAuthorization({
      permissions: ["pim.product.view", "orders.view"],
      roleScope: { channels: "all", customers: "all", price_lists: "all" },
      scopeValues: ALL_SCOPE,
      entitledApps: undefined,
    });
    expect(authz.can("pim.product.view")).toBe(true);
    expect(authz.can("orders.cancel")).toBe(false);
    expect(authz.permissions.has("orders.view")).toBe(true);
    expect(authz.ability.can("read", "Product")).toBe(true);
  });

  it("drops permissions for non-entitled apps before building the ability", () => {
    const authz = assembleAuthorization({
      permissions: ["pim.product.view", "orders.view"],
      roleScope: { channels: "all", customers: "all", price_lists: "all" },
      scopeValues: ALL_SCOPE,
      entitledApps: ["pim"],
    });
    expect(authz.can("orders.view")).toBe(false);
    expect(authz.ability.can("read", "Order")).toBe(false);
  });
});
