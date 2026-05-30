import { describe, it, expect } from "vitest";
import {
  ALL_SCOPE,
  scopeConditionsFor,
  type RoleScope,
  type ScopeValues,
} from "@/lib/auth/permissions/scope";

describe("scope conditions", () => {
  it("produces no conditions when every dimension is 'all'", () => {
    const role: RoleScope = { channels: "all", customers: "all", price_lists: "all" };
    expect(scopeConditionsFor(role, ALL_SCOPE)).toEqual({});
  });

  it("adds a channel $in condition on Order when channels are per_user", () => {
    const role: RoleScope = { channels: "per_user", customers: "all", price_lists: "all" };
    const values: ScopeValues = { channels: ["retail"], customers: "all", price_lists: "all" };
    expect(scopeConditionsFor(role, values)).toEqual({
      Order: { channel: { $in: ["retail"] } },
    });
  });

  it("ignores per_user dimensions whose value is 'all' (no constraint)", () => {
    const role: RoleScope = { channels: "per_user", customers: "all", price_lists: "all" };
    const values: ScopeValues = { channels: "all", customers: "all", price_lists: "all" };
    expect(scopeConditionsFor(role, values)).toEqual({});
  });
});
